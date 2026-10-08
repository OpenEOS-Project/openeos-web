'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';

import {
  ITEM_STATUS_TONE,
  cancellableQuantity,
  isStarted,
  paymentIcon,
  paymentKey,
  round2,
} from '@/utils/order-history';
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Chip,
  Chips,
  ChoiceGroup,
  Icon,
  Input,
  Segment,
  Stepper,
  Switch,
  Textarea,
} from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';

import { deviceApi } from '@/lib/api-client';

import { ApiException } from '@/types/api';
import {
  type CreateRefundData,
  type DeviceActor,
  type OrderDetail,
  REFUND_REASON_CODES,
  type RefundReasonCode,
  type RefundResult,
} from '@/types/order-history';

import { isPinError } from '../hooks/use-order-history';
import { errorReason } from '../hooks/use-pos-checkout';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

export interface RefundPreset {
  mode: 'items' | 'amount' | 'full';
  /** Positionen zugleich stornieren (Storno bezahlter Bestellungen). */
  cancelItems: boolean;
}

interface OrderRefundSheetProps {
  preset: RefundPreset | null;
  order: OrderDetail;
  onClose: () => void;
  run: (action: (actor: DeviceActor) => Promise<void>) => Promise<void>;
  onDone: () => void;
}

type Mode = RefundPreset['mode'];

interface ProviderFailure {
  message: string | null;
  error: string | null;
}

/**
 * Erstattung mit Gegenbeleg: nach Positionen/Mengen, freier Betrag oder
 * alles. Optional zugleich stornieren (Küche nimmt die Positionen heraus).
 * Der Rückgabeweg folgt der ursprünglichen Zahlung: bar (Kassenlade),
 * SumUp (über die SumUp-API, bei Fehler „manuell erstattet“), fremdes
 * Kartengerät (manuell). Jede Erstattung druckt einen Gegenbeleg.
 */
export function OrderRefundSheet({ preset, order, onClose, run, onDone }: OrderRefundSheetProps) {
  const t = useTranslations('pos.orderHistory');
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const open = preset !== null;

  const [mode, setMode] = useState<Mode>('items');
  const [cancelItems, setCancelItems] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState('');
  const [includeDeposit, setIncludeDeposit] = useState(true);
  const [paymentId, setPaymentId] = useState<string>('auto');
  const [reasonCode, setReasonCode] = useState<RefundReasonCode | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirmStarted, setConfirmStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ProviderFailure | null>(null);
  const [result, setResult] = useState<RefundResult | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const failureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!preset) return;
    setMode(preset.mode);
    setCancelItems(preset.cancelItems);
    setQty({});
    setAmount('');
    setIncludeDeposit(true);
    setReasonCode(null);
    setReasonText('');
    setConfirmStarted(false);
    setFailure(null);
    setResult(null);
    requestIds.current.clear();
    const refundable = order.payments.filter((p) => p.refundable > 0);
    setPaymentId(refundable.length === 1 ? refundable[0].id : 'auto');
    // Nur ein Kontext: preset wechselt beim Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // Ablehnung von SumUp sichtbar machen (auf kleinen Bildschirmen weiter unten).
  useEffect(() => {
    if (failure) failureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [failure]);

  const payments = order.payments.filter((p) => p.refundable > 0);
  const chosenPayment = payments.find((p) => p.id === paymentId) ?? null;
  const maxAmount = chosenPayment ? chosenPayment.refundable : order.refundable;
  const methodPayment =
    chosenPayment ??
    [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
    null;

  const items = useMemo(
    () =>
      order.items
        .map((item) => ({
          item,
          max: cancelItems ? cancellableQuantity(item) : item.refundableQuantity,
        }))
        .filter((x) => x.max > 0),
    [order.items, cancelItems]
  );
  const selected = items.filter(({ item }) => (qty[item.id] ?? 0) > 0);
  // Begonnene Positionen, die mit storniert würden (bei „Alles“ alle aktiven).
  const started = !cancelItems
    ? []
    : mode === 'full'
      ? order.items
          .filter((item) => cancellableQuantity(item) > 0 && isStarted(item.status))
          .map((item) => ({ item }))
      : selected.filter(({ item }) => isStarted(item.status));
  const hasDeposit = selected.some(({ item }) => item.depositAmount > 0);

  // Vorschau; der Server rechnet exakt (Rabatt, Pfand, Teilzahlungen).
  const preview = (() => {
    if (mode === 'full') return order.refundable;
    if (mode === 'amount') return Math.min(Number(amount.replace(',', '.')) || 0, maxAmount);
    const sum = selected.reduce((s, { item }) => {
      const n = qty[item.id] ?? 0;
      const deposit = cancelItems || includeDeposit ? item.depositAmount * n : 0;
      return s + item.unitRefund * n + deposit;
    }, 0);
    return Math.min(round2(sum), order.refundable);
  })();

  const amountValue = Number(amount.replace(',', '.'));
  const amountInvalid =
    mode === 'amount' && (!(amountValue > 0) || amountValue > maxAmount + 0.001);
  const nothingSelected = mode === 'items' && selected.length === 0;
  const canSubmit =
    !busy &&
    !!reasonCode &&
    !nothingSelected &&
    !amountInvalid &&
    (started.length === 0 || confirmStarted);

  const payload = (manual: boolean): CreateRefundData => ({
    mode,
    reasonCode: reasonCode!,
    ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}),
    ...(mode === 'items'
      ? { items: selected.map(({ item }) => ({ orderItemId: item.id, quantity: qty[item.id] })) }
      : {}),
    ...(mode === 'amount' ? { amount: round2(amountValue) } : {}),
    ...(mode !== 'amount' && cancelItems ? { cancelItems: true } : {}),
    ...(mode === 'items' && !cancelItems && !includeDeposit ? { includeDeposit: false } : {}),
    ...(paymentId !== 'auto' ? { paymentId } : {}),
    ...(started.length ? { confirmStarted: true } : {}),
    ...(manual ? { manual: true } : {}),
  });

  const submit = (manual: boolean) =>
    run(async (actor) => {
      const body = payload(manual);
      // Gleiche Anfrage nach Netzfehler = dieselbe Erstattung (idempotent).
      const key = JSON.stringify(body);
      const clientRequestId = requestIds.current.get(key) ?? crypto.randomUUID();
      requestIds.current.set(key, clientRequestId);
      setBusy(true);
      setFailure(null);
      try {
        const res = await deviceApi.createRefund(order.id, { ...body, ...actor, clientRequestId });
        setResult(res.data);
        onDone();
      } catch (error) {
        if (isPinError(error)) throw error;
        const reason = errorReason(error);
        if (reason === 'REFUND_PROVIDER_FAILED' && error instanceof ApiException) {
          setFailure({
            message: (error.params?.providerMessage as string | undefined) ?? null,
            error: (error.params?.providerError as string | undefined) ?? null,
          });
        } else if (reason === 'ORDER_ITEM_ALREADY_STARTED') {
          toast(t('startedTitle'), 'danger');
        } else {
          toast(apiErrorMessage(error), 'danger');
        }
      } finally {
        setBusy(false);
      }
    });

  const methodHint = (() => {
    if (!methodPayment) return null;
    const key = paymentKey(methodPayment.paymentMethod);
    if (order.isTest && key !== 'cash') return t('methodHint.test');
    return t(`methodHint.${key}`);
  })();

  const title = cancelItems
    ? t('cancelAndRefundTitle', { number: order.dailyNumber })
    : t('refundTitle', { number: order.dailyNumber });

  if (result) {
    const total = result.refunds.reduce((s, r) => s + r.amount, 0);
    const cash = result.refunds.some((r) => r.paymentMethod === 'cash');
    const printed = result.refunds.every((r) => r.printed);
    return (
      <PosSheet
        open={open}
        onClose={onClose}
        size="md"
        icon="check-circle"
        iconTone="accent"
        title={t('refundDone')}
        subtitle={result.refunds.map((r) => r.refundNumber).join(', ')}
        footer={
          <Button variant="primary" size="lg" className="oe-grow" onClick={onClose}>
            {t('done')}
          </Button>
        }
      >
        <div className="pos-oh-result">
          <b className="pos-oh-result__amount">{formatPrice(Math.abs(total))}</b>
          {result.refunds.map((r) => (
            <p key={r.id}>
              <Icon name={paymentIcon(r.paymentMethod)} />
              {r.status === 'test'
                ? t('resultTest')
                : r.status === 'manual'
                  ? t('resultManual', { amount: formatPrice(Math.abs(r.amount)) })
                  : r.paymentMethod === 'cash'
                    ? t('resultCash', { amount: formatPrice(Math.abs(r.amount)) })
                    : t('resultSumup', { amount: formatPrice(Math.abs(r.amount)) })}
            </p>
          ))}
          {cash && (
            <p>
              <Icon name="drawer" />
              {t('drawerOpened')}
            </p>
          )}
          <p className={printed ? undefined : 'pos-hint--warn'}>
            <Icon name="printer" />
            {printed ? t('receiptPrinted') : t('noPrinter')}
          </p>
        </div>
      </PosSheet>
    );
  }

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="wide"
      icon={cancelItems ? 'ban' : 'undo'}
      title={title}
      subtitle={t('refundableAmount', { amount: formatPrice(order.refundable) })}
      toolbar={
        <Segment<Mode>
          aria-label={t('refundMode')}
          size="lg"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setFailure(null);
          }}
          options={[
            { id: 'items', label: t('modeItems') },
            { id: 'amount', label: t('modeAmount'), disabled: cancelItems },
            { id: 'full', label: t('modeFull') },
          ]}
        />
      }
      footer={
        <>
          <span className="pos-ft-sum">
            <small>{t('refundSum')}</small>
            <b>{formatPrice(preview)}</b>
          </span>
          {/* Auf dem Telefon schließt das Blatt über Kreuz/Wischen; der Platz gehört der Aktion. */}
          <Button variant="ghost" size="lg" className="pos-oh-hide-sm" onClick={onClose}>
            {t('back')}
          </Button>
          <Button
            variant={cancelItems ? 'danger' : 'primary'}
            size="lg"
            disabled={!canSubmit}
            loading={busy}
            onClick={() => void submit(false)}
          >
            {!busy && <Icon name={cancelItems ? 'ban' : 'undo'} />}
            {cancelItems ? t('cancelAndRefundConfirm') : t('refundConfirm')}
          </Button>
        </>
      }
    >
      <div className="pos-oh-form">
        {mode !== 'amount' && (
          <Switch checked={cancelItems} onChange={(e) => setCancelItems(e.target.checked)}>
            <span className="pos-oh-switch">
              <b>{t('alsoCancel')}</b>
              <small>{t('alsoCancelHint')}</small>
            </span>
          </Switch>
        )}

        {mode === 'items' && (
          <ul className="pos-oh-pick">
            {items.length === 0 && <li className="pos-hint">{t('nothingToSelect')}</li>}
            {items.map(({ item, max }) => {
              const value = qty[item.id] ?? 0;
              return (
                <li
                  key={item.id}
                  className={
                    value > 0 ? (cancelItems ? 'is-selected is-cancel' : 'is-selected') : undefined
                  }
                >
                  <span className="pos-oh-pick__main">
                    <b>
                      {item.quantity}x {item.productName}
                    </b>
                    <span className="pos-row pos-row--wrap">
                      <Badge tone={ITEM_STATUS_TONE[item.status]}>
                        {t(`itemStatus.${item.status}`)}
                      </Badge>
                      <small>
                        {t('perUnit', { amount: formatPrice(item.unitRefund) })}
                        {item.depositAmount > 0
                          ? ` + ${t('depositShort', { amount: formatPrice(item.depositAmount) })}`
                          : ''}
                      </small>
                    </span>
                  </span>
                  <Stepper
                    size="lg"
                    value={value}
                    min={0}
                    max={max}
                    onDecrement={() => setQty((q) => ({ ...q, [item.id]: Math.max(0, value - 1) }))}
                    onIncrement={() =>
                      setQty((q) => ({ ...q, [item.id]: Math.min(max, value + 1) }))
                    }
                    labels={{ decrease: t('less'), increase: t('more') }}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {mode === 'items' && !cancelItems && hasDeposit && (
          <Switch checked={includeDeposit} onChange={(e) => setIncludeDeposit(e.target.checked)}>
            {t('includeDeposit')}
          </Switch>
        )}

        {mode === 'amount' && (
          <Input
            label={t('amountLabel')}
            hint={t('amountHint', { max: formatPrice(maxAmount) })}
            error={
              amount && amountInvalid
                ? t('amountInvalid', { max: formatPrice(maxAmount) })
                : undefined
            }
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0,00"
          />
        )}

        {mode === 'full' && (
          <p className="pos-hint">
            {cancelItems
              ? t('fullCancelHint', { amount: formatPrice(order.refundable) })
              : t('fullRefundHint', { amount: formatPrice(order.refundable) })}
          </p>
        )}

        {started.length > 0 && (
          <Banner tone="danger" icon={<Icon name="alert" />} title={t('startedTitle')}>
            <p>
              {t('startedText', { items: started.map(({ item }) => item.productName).join(', ') })}
            </p>
            <Checkbox
              checked={confirmStarted}
              onChange={(e) => setConfirmStarted(e.target.checked)}
            >
              {t('startedConfirm')}
            </Checkbox>
          </Banner>
        )}

        {payments.length > 1 && (
          <div className="pos-oh-reason">
            <small>{t('refundVia')}</small>
            <ChoiceGroup<string>
              aria-label={t('refundVia')}
              value={paymentId}
              onChange={setPaymentId}
              options={[
                { id: 'auto', label: t('refundViaAuto'), icon: 'refresh' },
                ...payments.map((p) => ({
                  id: p.id,
                  label: t(`payment.${paymentKey(p.paymentMethod)}`),
                  icon: paymentIcon(p.paymentMethod),
                  hint: t('refundableAmount', { amount: formatPrice(p.refundable) }),
                })),
              ]}
            />
          </div>
        )}

        {methodHint && (
          <p className="pos-oh-method">
            <Icon name={methodPayment ? paymentIcon(methodPayment.paymentMethod) : 'cash'} />
            {methodHint}
          </p>
        )}

        <div className="pos-oh-reason">
          <small>{t('reasonRequired')}</small>
          <Chips>
            {REFUND_REASON_CODES.map((code) => (
              <Chip
                key={code}
                active={reasonCode === code}
                onClick={() => setReasonCode(reasonCode === code ? null : code)}
              >
                {t(`reasons.${code}`)}
              </Chip>
            ))}
          </Chips>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            aria-label={t('reasonText')}
            rows={2}
            maxLength={500}
          />
        </div>

        {failure && (
          <div ref={failureRef}>
            <Banner tone="danger" icon={<Icon name="alert" />} title={t('sumupFailedTitle')}>
              <p>{failure.message || failure.error || t('sumupFailedText')}</p>
              <p>{t('sumupManualHint')}</p>
              <div className="pos-row pos-row--wrap">
                <Button variant="secondary" disabled={busy} onClick={() => void submit(false)}>
                  <Icon name="refresh" />
                  {t('retry')}
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => void submit(true)}>
                  <Icon name="check" />
                  {t('markManual')}
                </Button>
              </div>
            </Banner>
          </div>
        )}
      </div>
    </PosSheet>
  );
}
