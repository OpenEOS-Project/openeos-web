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
  type ChoiceOption,
} from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import type { AppliedVoucher } from '@/stores/cart-store';
import type { DiscountVoucher } from '@/types/discount-voucher';
import { usePosCompact } from '../hooks/use-pos-compact';
import { useSumupCheckout } from '../hooks/use-sumup-checkout';
import { PosSheet } from './pos-sheet';

type Method = 'cash' | 'card' | 'discount';

export interface PayResult {
  /** `sumup` = Lesegerät, `card` = externes Terminal (nur Buchung), `free` = Betrag 0. */
  method: 'cash' | 'card' | 'sumup' | 'free';
  amountReceived?: number;
  tip: number;
  transactionId?: string | null;
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
  /** `sumup` mit Lesegerät, `manual` als Buchung ohne Gerät, `null` = keine Karte. */
  card: 'sumup' | 'manual' | null;
  /** Rabatt-Bons (nur beim Kassieren des Warenkorbs). */
  discount?: PayDiscount | null;
  /** „Rechnung teilen“ — nur wenn es etwas zu teilen gibt. */
  onSplit?: () => void;
  /** Bucht die Zahlung; wirft bei Fehlern (die Kasse zeigt sie als Hinweis). */
  onPay: (result: PayResult) => Promise<void>;
  /** Offline: Abschließen gesperrt. */
  disabled?: boolean;
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
}: PaySheetProps) {
  const t = useTranslations('pos.pay');
  const formatPrice = useFormatPrice();
  const compact = usePosCompact();

  const [method, setMethod] = useState<Method>('cash');
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

  const run = async (result: PayResult) => {
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

  // Beim Öffnen zurücksetzen.
  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setGiven('');
    setQuickPicked(false);
    setTip(0);
    setCustomTip(null);
    setManual(null);
    setManualValue('');
    setUnsaved(readUnsaved(persistKey));
    drawerOpened.current = false;
    sumup.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Kassenlade beim ersten Wechsel auf Bar je Vorgang öffnen (wie bisher
  // beim Öffnen des Bar-Dialogs) — Rückgeld lässt sich so schon während
  // der Eingabe abzählen.
  useEffect(() => {
    if (!open || method !== 'cash' || drawerOpened.current || amount <= 0) return;
    drawerOpened.current = true;
    deviceApi.openCashDrawer().catch(() => {});
  }, [open, method, amount]);

  const givenAmount = given ? parseInt(given, 10) / 100 : 0;
  const change = givenAmount - amount;
  const quick = useMemo(() => quickAmounts(amount), [amount]);
  const roundUpTip = Math.max(0, Math.round((Math.ceil(amount - 0.0001) - amount) * 100) / 100);
  const cardBusy = sumup.busy || sumup.state === 'success';
  const locked = busy || cardBusy || !!unsaved;

  const methodOptions: ChoiceOption<Method>[] = [
    { id: 'cash', label: t('cash'), icon: 'cash' },
    ...(card ? [{ id: 'card' as const, label: t('card'), icon: 'contactless' as const, hint: card === 'manual' ? t('cardManualHint') : undefined }] : []),
    ...(discount && discount.vouchers.length > 0
      ? [{ id: 'discount' as const, label: t('discount'), icon: 'ticket' as const }]
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
        {t('cardManual', { amount: formatPrice(amount) })}
      </Button>
    );
  } else if (method === 'card') {
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
        onClick={() => sumup.start(amount + tip)}
      >
        {!(busy || sumup.state === 'success') && <Icon name="contactless" />}
        {sumup.state === 'failed' || sumup.state === 'cancelled'
          ? t('cardRetry')
          : t('cardStart', { amount: formatPrice(amount + tip) })}
      </Button>
    );
  } else {
    primary = (
      <Button variant="primary" size="lg" className="oe-grow" onClick={() => setMethod('cash')}>
        <Icon name="arrow-right" />
        {t('continue')}
      </Button>
    );
  }

  // ── Rechte Spalte ──────────────────────────────────────────────────
  let right: React.ReactNode = null;
  if (unsaved) {
    right = (
      <Banner tone="danger" icon={<Icon name="alert" />} title={t('unsavedTitle')}>
        {t('unsavedText', {
          amount: formatPrice(amount + unsaved.tip),
          id: unsaved.transactionId ?? '-',
        })}
      </Banner>
    );
  } else if (amount <= 0) {
    right = (
      <Prompt icon="check-circle" title={t('freeTitle')} text={t('freeText')} />
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
          <Button variant="secondary" onClick={() => pickQuick(amount)}>
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
    right = <Prompt icon="card" title={t('cardManualTitle')} text={t('cardManualText', { amount: formatPrice(amount) })} />;
  } else if (method === 'card') {
    if (sumup.busy || sumup.state === 'success') {
      right = (
        <Prompt
          icon={sumup.state === 'success' ? 'check-circle' : 'contactless'}
          title={sumup.state === 'success' ? t('cardSuccess') : t('cardWaitTitle')}
          text={
            sumup.state === 'initiating'
              ? t('cardProcessing')
              : t('cardWaitText', { amount: formatPrice(amount + tip) })
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
                  {t('tipRoundUp', { amount: formatPrice(amount + roundUpTip) })}
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
            text={t('cardWaitText', { amount: formatPrice(amount + tip) })}
          />
        </>
      );
    }
  } else if (discount) {
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
          {amount > 0 && !unsaved && (
            <ChoiceGroup
              options={methodOptions.map((o) => ({ ...o, disabled: locked }))}
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
        <div className="pos-pay__r">{right}</div>
      </div>
    </PosSheet>
  );
}
