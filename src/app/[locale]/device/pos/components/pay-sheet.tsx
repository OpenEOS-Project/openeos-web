'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Banner,
  Button,
  Chip,
  Chips,
  ChoiceGroup,
  Icon,
  Keypad,
  Prompt,
  Spinner,
  Stepper,
  type ChoiceOption,
} from '@openeos/ui';
import { useDeviceOperatingMode } from '@/hooks/use-operating-mode';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { useDeviceStore } from '@/stores/device-store';
import type { AppliedVoucher } from '@/stores/cart-store';
import type { DiscountVoucher } from '@/types/discount-voucher';
import { tokenTenders, tokenValue, tokensValueCents, type TokenTender, type TokenType } from '@/types/token';
import { shouldOpenCashDrawer } from '@/utils/cash-drawer';
import { initialPayMethod, type PayMethod, type PosCardMode } from '@/utils/pos-card-mode';
import { usePosCompact } from '../hooks/use-pos-compact';
import { useSumupCheckout } from '../hooks/use-sumup-checkout';
import { PosSheet } from './pos-sheet';

/** `tokens`: Wertmarken eingeben (vollständig mit Marken: Abschluss ohne Geld). */
type Method = PayMethod | 'tokens';

export interface PayResult {
  /**
   * `sumup` = Lesegerät, `card` = externes Terminal (nur Buchung), `free` =
   * Betrag 0, `tokens` = nur mit Wertmarken bezahlt.
   */
  method: 'cash' | 'card' | 'sumup' | 'free' | 'tokens';
  amountReceived?: number;
  tip: number;
  transactionId?: string | null;
  /** Vom Gast erhaltene Wertmarken (der Rest geht über `method`). */
  tokens?: TokenTender[];
  /** Marken mehr wert als offen: Rest als Trinkgeld gebucht. */
  tokenExcessAsTip?: boolean;
  /** Wert der Marken (Euro), für das Abschluss-Blatt. */
  tokenValue?: number;
}

export interface PayDiscount {
  vouchers: DiscountVoucher[];
  applied: AppliedVoucher[];
  onApply: (voucher: Omit<AppliedVoucher, 'uid'>) => void;
  onRemove: (uid: string) => void;
}

interface PaySheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Zu zahlen (nach Rabatt). */
  amount: number;
  /** Enthaltenes Pfand (Unterzeile „inkl. … Pfand“). */
  pfandIncluded?: number;
  /**
   * `sumup` mit Lesegerät, `sumup_test` = Lesegerät, aber Testmodus
   * (Zahlart deaktiviert), `manual` als Buchung ohne Gerät, `null` = keine Karte.
   */
  card: PosCardMode;
  /** Rabatt-Bons (nur beim Kassieren des Warenkorbs). */
  discount?: PayDiscount | null;
  /** „Rechnung teilen“ — nur wenn es etwas zu teilen gibt. */
  onSplit?: () => void;
  /** Bucht die Zahlung; wirft bei Fehlern (die Kasse zeigt sie als Hinweis). */
  onPay: (result: PayResult) => Promise<void>;
  /** Offline: Abschließen gesperrt. */
  disabled?: boolean;
  /**
   * Markentypen (Wertmarken), die die Kasse annimmt — leer/fehlend ohne
   * Wertmarken (nur „Alle Funktionen“, in DE mit Cloud-TSE).
   */
  tokenTypes?: TokenType[];
  /**
   * Schlüssel in `sessionStorage`, unter dem eine erfolgreiche, aber nicht
   * gespeicherte Kartenzahlung liegt — nach Neuladen bleibt „Erneut
   * speichern“ erreichbar statt erneut zu kassieren.
   */
  persistKey?: string;
}

const TIP_PRESETS = [0.5, 1, 2] as const;

/**
 * Schnellwahl wie im Entwurf: Passend, nächste 10 €, nächste 20 €, 50 € —
 * nur Werte ≥ Betrag, ohne Doppelte, höchstens drei Knöpfe. Geliefert
 * werden die Beträge nach „Passend“.
 */
export function quickAmounts(amount: number): number[] {
  const cents = Math.round(amount * 100);
  const candidates = [cents, Math.ceil(cents / 1000) * 1000, Math.ceil(cents / 2000) * 2000, 5000];
  return candidates
    .filter((v, i, all) => all.indexOf(v) === i && v >= cents)
    .slice(0, 3)
    .slice(1)
    .map((v) => v / 100);
}

/** Kartenzahlung erfolgreich, Bestellung nicht gespeichert — übersteht Neuladen. */
function readUnsaved(key: string | undefined): PayResult | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PayResult) : null;
  } catch {
    return null;
  }
}

function writeUnsaved(key: string | undefined, value: PayResult | null) {
  if (!key || typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(key, JSON.stringify(value));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Speicher voll/gesperrt: dann nur im Blatt
  }
}

/**
 * Kassieren-Blatt: links der Betrag und die Zahlart, rechts die Eingabe
 * (Bar: gegeben/Rückgeld; Karte: Trinkgeld und Lesegerät; Rabatt: Bons).
 *
 * Ohne Bargeld („Bargeldlos“ oder „Alle Funktionen“ ohne TSE in
 * Deutschland) gibt es keine Bar-Zahlart, keine Schnellwahl und kein Rückgeld; Karte (mit Trinkgeld), Rabatt und
 * „Rechnung teilen“ bleiben. Gilt für jede Stelle, die dieses Blatt nutzt
 * (Warenkorb, offene Bestellungen, Verlauf, Teilen).
 */
export function PaySheet({
  open,
  onClose,
  title,
  subtitle,
  amount,
  pfandIncluded = 0,
  card,
  discount,
  onSplit,
  onPay,
  disabled = false,
  persistKey,
  tokenTypes = [],
}: PaySheetProps) {
  const t = useTranslations('pos.pay');
  const formatPrice = useFormatPrice();
  const compact = usePosCompact();
  const cashless = !useDeviceOperatingMode().cashAllowed;
  const deviceSettings = useDeviceStore((s) => s.settings);
  const firstMethod = initialPayMethod({
    cashless,
    card,
    hasVouchers: !!discount && discount.vouchers.length > 0,
  });

  const [method, setMethod] = useState<Method | null>(firstMethod);
  const [given, setGiven] = useState('');
  /** Nach einer Schnellwahl beginnt die nächste Ziffer einen neuen Betrag. */
  const [quickPicked, setQuickPicked] = useState(false);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState<string | null>(null);
  const [manual, setManual] = useState<DiscountVoucher | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [busy, setBusy] = useState(false);
  /** Kartenzahlung gelungen, Buchung gescheitert — nur „Erneut speichern“. */
  const [unsaved, setUnsaved] = useState<PayResult | null>(null);
  const drawerOpened = useRef(false);
  /** Wertmarken je Typ (Stück) und ob ein Überschuss Trinkgeld wird. */
  const [tokenCounts, setTokenCounts] = useState<Record<string, number>>({});
  const [excessAsTip, setExcessAsTip] = useState(false);
  const tokenCents = tokensValueCents(tokenTypes, tokenCounts);
  const amountCents = Math.round(amount * 100);
  /** Geld, das nach den Marken noch offen ist. */
  const moneyDue = Math.max(0, amountCents - tokenCents) / 100;
  /** Marken mehr wert als offen (Wechselgeld in Marken gibt es nicht). */
  const tokenExcess = Math.max(0, tokenCents - amountCents) / 100;
  const tokenFields = (): Pick<PayResult, 'tokens' | 'tokenExcessAsTip' | 'tokenValue'> =>
    tokenCents > 0
      ? {
          tokens: tokenTenders(tokenCounts),
          tokenValue: tokenCents / 100,
          ...(tokenExcess > 0 ? { tokenExcessAsTip: true } : {}),
        }
      : {};

  const run = async (base: PayResult) => {
    const result = base.tokens ? base : { ...base, ...tokenFields() };
    setBusy(true);
    try {
      await onPay(result);
      setUnsaved(null);
      writeUnsaved(persistKey, null);
    } catch {
      if (result.method === 'sumup') {
        setUnsaved(result);
        writeUnsaved(persistKey, result);
      }
    } finally {
      setBusy(false);
    }
  };

  const sumup = useSumupCheckout(({ transactionId }) => {
    void run({ method: 'sumup', tip, transactionId });
  });
  const setTokenCount = (id: string, count: number) => {
    setTokenCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(999, count)) }));
    setExcessAsTip(false);
  };

  // Beim Öffnen zurücksetzen.
  useEffect(() => {
    if (!open) return;
    setMethod(firstMethod);
    setGiven('');
    setQuickPicked(false);
    setTip(0);
    setCustomTip(null);
    setManual(null);
    setManualValue('');
    setUnsaved(readUnsaved(persistKey));
    setTokenCounts({});
    setExcessAsTip(false);
    drawerOpened.current = false;
    sumup.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Kassenlade beim ersten Wechsel auf Bar je Vorgang öffnen (wie bisher
  // beim Öffnen des Bar-Dialogs) — Rückgeld lässt sich so schon während
  // der Eingabe abzählen. Nur, wenn dem Gerät ein Drucker mit Lade
  // zugeordnet ist: sonst lehnt die API jeden Aufruf ab (#85).
  useEffect(() => {
    if (
      !shouldOpenCashDrawer({
        open,
        method,
        amount,
        cashless,
        settings: deviceSettings,
        alreadyOpened: drawerOpened.current,
      })
    ) {
      return;
    }
    drawerOpened.current = true;
    deviceApi.openCashDrawer('payment').catch(() => {});
  }, [open, cashless, method, amount, deviceSettings]);

  const givenAmount = given ? parseInt(given, 10) / 100 : 0;
  // Bar und Karte kassieren nur, was nach den Wertmarken offen ist.
  const change = givenAmount - moneyDue;
  const quick = useMemo(() => quickAmounts(moneyDue), [moneyDue]);
  const roundUpTip = Math.max(0, Math.round((Math.ceil(moneyDue - 0.0001) - moneyDue) * 100) / 100);
  const cardBusy = sumup.busy || sumup.state === 'success';
  const locked = busy || cardBusy || !!unsaved;

  // Modus wechselt bei offenem Blatt (Socket): Bar nicht stehen lassen.
  useEffect(() => {
    if (open && cashless && method === 'cash') setMethod(firstMethod);
  }, [open, cashless, method, firstMethod]);

  const methodOptions: ChoiceOption<Method>[] = [
    ...(cashless ? [] : [{ id: 'cash' as const, label: t('cash'), icon: 'cash' as const }]),
    ...(card
      ? [
          {
            id: 'card' as const,
            label: t('card'),
            icon: 'contactless' as const,
            // Testmodus: keine echte Kartenzahlung, kein Aufruf am Lesegerät.
            disabled: card === 'sumup_test',
            hint:
              card === 'manual'
                ? t('cardManualHint')
                : card === 'sumup_test'
                  ? t('cardTestModeHint')
                  : undefined,
          },
        ]
      : []),
    ...(tokenTypes.length > 0
      ? [
          {
            id: 'tokens' as const,
            label: tokenCents > 0 ? t('tokensWithValue', { amount: formatPrice(tokenCents / 100) }) : t('tokens'),
            icon: 'ticket' as const,
          },
        ]
      : []),
    ...(discount && discount.vouchers.length > 0
      ? [{ id: 'discount' as const, label: t('discount'), icon: 'percent' as const }]
      : []),
  ];

  const pressCash = (key: string) => {
    const base = quickPicked ? '' : given;
    setQuickPicked(false);
    if (key === 'backspace') setGiven(base.slice(0, -1));
    else setGiven((base + key).replace(/^0+/, '').slice(0, 6));
  };
  const pickQuick = (value: number) => {
    setGiven(String(Math.round(value * 100)));
    setQuickPicked(true);
  };
  const pressManual = (key: string) => {
    if (key === 'backspace') setManualValue((g) => g.slice(0, -1));
    else setManualValue((g) => (g + key).replace(/^0+/, '').slice(0, 6));
  };

  const applyVoucher = (voucher: DiscountVoucher) => {
    if (!discount) return;
    if (voucher.type === 'manual') {
      setManual(voucher);
      setManualValue('');
      return;
    }
    discount.onApply({
      id: voucher.id,
      name: voucher.name,
      amount: Number(voucher.amount ?? 0),
      allowMultiple: voucher.allowMultiplePerOrder,
    });
  };

  const confirmManual = () => {
    if (!discount || !manual || !manualValue) return;
    discount.onApply({
      id: manual.id,
      name: manual.name,
      amount: parseInt(manualValue, 10) / 100,
      allowMultiple: manual.allowMultiplePerOrder,
    });
    setManual(null);
    setManualValue('');
  };

  // ── Fuß ────────────────────────────────────────────────────────────
  let primary: React.ReactNode;
  if (unsaved) {
    primary = (
      <Button variant="primary" size="lg" className="oe-grow" loading={busy} onClick={() => run(unsaved)}>
        {!busy && <Icon name="refresh" />}
        {t('saveAgain')}
      </Button>
    );
  } else if (amount <= 0) {
    primary = (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        loading={busy}
        disabled={disabled}
        onClick={() => run({ method: 'free', tip: 0 })}
      >
        {!busy && <Icon name="check" />}
        {t('completeFree')}
      </Button>
    );
  } else if (tokenCents > 0 && moneyDue <= 0) {
    // Vollständig mit Wertmarken bezahlt (ggf. Überschuss als Trinkgeld).
    primary = (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        loading={busy}
        disabled={disabled || (tokenExcess > 0 && !excessAsTip)}
        onClick={() => run({ method: 'tokens', tip: 0, ...tokenFields() })}
      >
        {!busy && <Icon name="check" />}
        {t('tokensComplete')}
      </Button>
    );
  } else if (method === 'tokens') {
    // Marken decken nicht alles: weiter zur Zahlart für den Rest.
    const restMethod: Method | null = !cashless ? 'cash' : card && card !== 'sumup_test' ? 'card' : null;
    primary = (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        disabled={!restMethod}
        onClick={() => restMethod && setMethod(restMethod)}
      >
        <Icon name="arrow-right" />
        {tokenCents > 0 ? t('tokensRest', { amount: formatPrice(moneyDue) }) : t('continue')}
      </Button>
    );
  } else if (method === 'cash') {
    primary = (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        loading={busy}
        disabled={disabled || !given || change < -0.0001}
        onClick={() => run({ method: 'cash', amountReceived: givenAmount, tip: 0 })}
      >
        {!busy && <Icon name="check" />}
        {t('complete')}
      </Button>
    );
  } else if (method === 'card' && card === 'manual') {
    primary = (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        loading={busy}
        disabled={disabled}
        onClick={() => run({ method: 'card', tip: 0 })}
      >
        {!busy && <Icon name="check" />}
        {t('cardManual', { amount: formatPrice(moneyDue) })}
      </Button>
    );
  } else if (method === 'card' && card === 'sumup') {
    primary = sumup.busy ? (
      <Button variant="secondary" size="lg" className="oe-grow" onClick={() => sumup.cancel()}>
        <Icon name="x" />
        {t('cardCancel')}
      </Button>
    ) : (
      <Button
        variant="primary"
        size="lg"
        className="oe-grow"
        loading={busy || sumup.state === 'success'}
        disabled={disabled}
        onClick={() => sumup.start(moneyDue + tip)}
      >
        {!(busy || sumup.state === 'success') && <Icon name="contactless" />}
        {sumup.state === 'failed' || sumup.state === 'cancelled'
          ? t('cardRetry')
          : t('cardStart', { amount: formatPrice(moneyDue + tip) })}
      </Button>
    );
  } else if (method === 'discount' && firstMethod && firstMethod !== 'discount') {
    primary = (
      <Button variant="primary" size="lg" className="oe-grow" onClick={() => setMethod(firstMethod)}>
        <Icon name="arrow-right" />
        {t('continue')}
      </Button>
    );
  } else {
    // Bargeldlos ohne nutzbare Karte: nichts zu kassieren.
    primary = (
      <Button variant="primary" size="lg" className="oe-grow" disabled>
        <Icon name="ban" />
        {t('noMethod')}
      </Button>
    );
  }

  // ── Rechte Spalte ──────────────────────────────────────────────────
  let right: React.ReactNode = null;
  if (unsaved) {
    right = (
      <Banner tone="danger" icon={<Icon name="alert" />} title={t('unsavedTitle')}>
        {t('unsavedText', {
          amount: formatPrice(Math.max(0, amount - (unsaved.tokenValue ?? 0)) + unsaved.tip),
          id: unsaved.transactionId ?? '-',
        })}
      </Banner>
    );
  } else if (amount <= 0) {
    right = (
      <Prompt icon="check-circle" title={t('freeTitle')} text={t('freeText')} />
    );
  } else if (method === 'tokens') {
    right = (
      <>
        <ul className="pos-list" aria-label={t('tokensList')}>
          {tokenTypes.map((type) => {
            const count = tokenCounts[type.id] || 0;
            return (
              <li key={type.id} className="pos-list__row">
                <span className="pos-list__main">
                  <b>
                    {type.color && (
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: type.color,
                          marginRight: 8,
                          verticalAlign: 'middle',
                        }}
                      />
                    )}
                    {type.name}
                  </b>
                  <small>
                    {formatPrice(tokenValue(type))}
                    {type.kind === 'single_purpose' ? ` · ${t('tokensSinglePurpose', { rate: Number(type.vatRate) })}` : ''}
                  </small>
                </span>
                <Stepper
                  value={count}
                  onDecrement={() => setTokenCount(type.id, count - 1)}
                  onIncrement={() => setTokenCount(type.id, count + 1)}
                  labels={{
                    decrease: t('tokensDecrease', { name: type.name }),
                    increase: t('tokensIncrease', { name: type.name }),
                  }}
                />
              </li>
            );
          })}
        </ul>
        {tokenExcess > 0 ? (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('tokensExcessTitle', { amount: formatPrice(tokenExcess) })}>
            <p>{t('tokensExcessText')}</p>
            <label className="pos-check">
              <input type="checkbox" checked={excessAsTip} onChange={(e) => setExcessAsTip(e.target.checked)} />{' '}
              {t('tokensExcessAsTip', { amount: formatPrice(tokenExcess) })}
            </label>
          </Banner>
        ) : (
          <p className="pos-hint">
            {tokenCents > 0
              ? moneyDue > 0
                ? t('tokensRestHint', { tokens: formatPrice(tokenCents / 100), rest: formatPrice(moneyDue) })
                : t('tokensCoveredHint')
              : t('tokensHint')}
          </p>
        )}
      </>
    );
  } else if (method === 'cash') {
    right = (
      <>
        <div className="oe-given">
          <span className="oe-label">{t('given')}</span>
          <b>{given ? formatPrice(givenAmount) : ''}</b>
          <span className={given && change < -0.0001 ? 'oe-change oe-change--neg' : 'oe-change'}>
            {!given
              ? t('givenHint')
              : change >= -0.0001
                ? t('change', { amount: formatPrice(Math.max(0, change)) })
                : t('missing', { amount: formatPrice(-change) })}
          </span>
        </div>
        <div className="pos-quick">
          <Button variant="secondary" onClick={() => pickQuick(moneyDue)}>
            {t('exact')}
          </Button>
          {quick.map((value) => (
            <Button key={value} variant="secondary" onClick={() => pickQuick(value)}>
              {formatPrice(value)}
            </Button>
          ))}
        </div>
        <Keypad
          keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']}
          onKey={pressCash}
          labels={{ backspace: t('backspace') }}
          aria-label={t('keypad')}
        />
      </>
    );
  } else if (method === 'card' && card === 'manual') {
    right = <Prompt icon="card" title={t('cardManualTitle')} text={t('cardManualText', { amount: formatPrice(moneyDue) })} />;
  } else if (method === 'card' && card === 'sumup') {
    if (sumup.busy || sumup.state === 'success') {
      right = (
        <Prompt
          icon={sumup.state === 'success' ? 'check-circle' : 'contactless'}
          title={sumup.state === 'success' ? t('cardSuccess') : t('cardWaitTitle')}
          text={
            sumup.state === 'initiating'
              ? t('cardProcessing')
              : t('cardWaitText', { amount: formatPrice(moneyDue + tip) })
          }
        >
          <Spinner />
        </Prompt>
      );
    } else {
      right = (
        <>
          {(sumup.state === 'failed' || sumup.state === 'cancelled') && (
            <Banner tone="danger" icon={<Icon name="alert" />}>
              {sumup.state === 'failed' ? sumup.error : t('cardCancelled')}
            </Banner>
          )}
          <div className="pos-group">
            <span className="oe-label">{t('tip')}</span>
            <Chips>
              <Chip active={customTip === null && tip === 0} onClick={() => { setCustomTip(null); setTip(0); }}>
                {t('tipNone')}
              </Chip>
              {roundUpTip > 0 && (
                <Chip
                  active={customTip === null && tip === roundUpTip}
                  onClick={() => { setCustomTip(null); setTip(roundUpTip); }}
                >
                  {t('tipRoundUp', { amount: formatPrice(moneyDue + roundUpTip) })}
                </Chip>
              )}
              {TIP_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  active={customTip === null && tip === preset}
                  onClick={() => { setCustomTip(null); setTip(preset); }}
                >
                  {`+${formatPrice(preset)}`}
                </Chip>
              ))}
              <Chip active={customTip !== null} onClick={() => setCustomTip(customTip ?? '')}>
                {t('tipCustom')}
              </Chip>
            </Chips>
            {customTip !== null && (
              <input
                className="oe-input pos-tipinput"
                inputMode="decimal"
                aria-label={t('tipCustomLabel')}
                placeholder={t('tipCustomLabel')}
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  const parsed = parseFloat(e.target.value.replace(',', '.'));
                  setTip(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0);
                }}
              />
            )}
          </div>
          <Prompt
            icon="contactless"
            title={t('cardReadyTitle')}
            text={t('cardWaitText', { amount: formatPrice(moneyDue + tip) })}
          />
        </>
      );
    }
  } else if (method === 'discount' && discount) {
    right = manual ? (
      <>
        <div className="oe-given">
          <span className="oe-label">{t('discountManualFor', { name: manual.name })}</span>
          <b>{manualValue ? formatPrice(parseInt(manualValue, 10) / 100) : ''}</b>
        </div>
        <Keypad
          keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'backspace']}
          onKey={pressManual}
          labels={{ backspace: t('backspace') }}
          aria-label={t('keypad')}
        />
        <div className="pos-row">
          <Button variant="ghost" onClick={() => setManual(null)}>
            {t('back')}
          </Button>
          <Button variant="secondary" className="oe-grow" disabled={!manualValue} onClick={confirmManual}>
            <Icon name="check" />
            {t('discountApply')}
          </Button>
        </div>
      </>
    ) : (
      <div className="pos-group">
        <span className="oe-label">{t('discountChoose')}</span>
        <Chips>
          {discount.vouchers.map((voucher) => {
            const used =
              !voucher.allowMultiplePerOrder && discount.applied.some((a) => a.id === voucher.id);
            return (
              <Chip key={voucher.id} className="pos-chip" active={used} disabled={used} onClick={() => applyVoucher(voucher)}>
                {used && <Icon name="check" />}
                {voucher.name}
                <span className="pos-chip__price">
                  {voucher.type === 'manual' ? t('discountManual') : `-${formatPrice(Number(voucher.amount ?? 0))}`}
                </span>
              </Chip>
            );
          })}
        </Chips>
      </div>
    );
  }

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      dismissible={!locked}
      size="pay"
      icon="receipt"
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="ghost" disabled={locked} onClick={onClose}>
            {t('back')}
          </Button>
          {primary}
        </>
      }
    >
      <div className="pos-pay">
        <div className="pos-pay__l">
          <div className="oe-due">
            <span className="oe-label">{t('due')}</span>
            <b className="oe-due__amount">{formatPrice(amount)}</b>
            {pfandIncluded > 0 && <small>{t('inclPfand', { amount: formatPrice(pfandIncluded) })}</small>}
            {tokenCents > 0 && (
              <small className="pos-pay__tokens">
                {t('tokensApplied', { amount: formatPrice(Math.min(tokenCents / 100, amount)) })}
                {' · '}
                <b>{t('tokensRestShort', { amount: formatPrice(moneyDue) })}</b>
              </small>
            )}
          </div>
          {discount && discount.applied.length > 0 && (
            <Chips className="pos-applied">
              {discount.applied.map((voucher) => (
                <Chip
                  key={voucher.uid}
                  active
                  onRemove={locked ? undefined : () => discount.onRemove(voucher.uid)}
                  removeLabel={t('discountRemove', { name: voucher.name })}
                >
                  {voucher.name} {`-${formatPrice(voucher.amount)}`}
                </Chip>
              ))}
            </Chips>
          )}
          {amount > 0 && !unsaved && methodOptions.length > 0 && (
            <ChoiceGroup
              options={methodOptions.map((o) => ({ ...o, disabled: locked || o.disabled }))}
              value={method}
              onChange={(id) => {
                setMethod(id);
                if (id !== 'discount') setManual(null);
              }}
              layout={compact ? 'row' : 'stack'}
              aria-label={t('methods')}
            />
          )}
          {onSplit && !locked && (
            <Button variant="ghost" size="sm" className="pos-pay__split" onClick={onSplit}>
              <Icon name="split" />
              {t('split')}
            </Button>
          )}
        </div>
        <div className="pos-pay__r">
          {right ??
            (amount > 0 && !method ? (
              <Banner tone="warn" icon={<Icon name="alert" />} title={t('cashlessNoMethodTitle')}>
                {card === 'sumup_test' ? t('cashlessNoMethodTest') : t('cashlessNoMethodText')}
              </Banner>
            ) : null)}
        </div>
      </div>
    </PosSheet>
  );
}
