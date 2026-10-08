'use client';

import { useEffect, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';

import { ITEM_STATUS_TONE, cancellableQuantity, isStarted } from '@/utils/order-history';
import { Badge, Banner, Button, Checkbox, Chip, Chips, Icon, Stepper, Textarea } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';

import { deviceApi } from '@/lib/api-client';

import {
  type DeviceActor,
  type OrderDetail,
  REFUND_REASON_CODES,
  type RefundReasonCode,
} from '@/types/order-history';

import { isPinError } from '../hooks/use-order-history';
import { errorReason } from '../hooks/use-pos-checkout';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

interface OrderCancelSheetProps {
  open: boolean;
  order: OrderDetail;
  onClose: () => void;
  run: (action: (actor: DeviceActor) => Promise<void>) => Promise<void>;
  onDone: () => void;
  /** Die Positionen sind schon bezahlt: weiter zur Erstattung. */
  onRefundRequired: () => void;
}

/**
 * Positionen einer (noch nicht bezahlten) Bestellung stornieren —
 * einzeln oder in Teilmengen. Solange die Küche nicht begonnen hat, geht
 * der Bestand zurück und die Station nimmt die Position live heraus.
 * Begonnene Positionen nur mit ausdrücklicher Bestätigung und Grund.
 */
export function OrderCancelSheet({
  open,
  order,
  onClose,
  run,
  onDone,
  onRefundRequired,
}: OrderCancelSheetProps) {
  const t = useTranslations('pos.orderHistory');
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const items = useMemo(() => order.items.filter((i) => cancellableQuantity(i) > 0), [order.items]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<RefundReasonCode | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirmStarted, setConfirmStarted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Eine einzige Position ist gleich vorgewählt.
    setQty(items.length === 1 ? { [items[0].id]: cancellableQuantity(items[0]) } : {});
    setReasonCode(null);
    setReasonText('');
    setConfirmStarted(false);
  }, [open, items]);

  const selected = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const started = selected.filter((i) => isStarted(i.status));
  const all = items.length > 0 && items.every((i) => (qty[i.id] ?? 0) === cancellableQuantity(i));
  const count = selected.reduce((s, i) => s + (qty[i.id] ?? 0), 0);
  const value = selected.reduce((s, i) => s + (i.unitPrice + i.optionsPrice) * (qty[i.id] ?? 0), 0);
  const needsReason = started.length > 0;
  const canSubmit = count > 0 && (!needsReason || (confirmStarted && !!reasonCode)) && !busy;

  const submit = () =>
    run(async (actor) => {
      setBusy(true);
      try {
        await deviceApi.cancelOrderItems(order.id, {
          ...actor,
          items: selected.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] })),
          ...(reasonCode ? { reasonCode } : {}),
          ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}),
          ...(started.length ? { confirmStarted: true } : {}),
        });
        toast(t('cancelItemsSuccess', { count }));
        onDone();
      } catch (error) {
        if (isPinError(error)) throw error;
        const reason = errorReason(error);
        if (reason === 'ORDER_PAID_REFUND_REQUIRED') {
          toast(t('paidNeedsRefund'), 'danger');
          onRefundRequired();
        } else {
          toast(apiErrorMessage(error), 'danger');
        }
      } finally {
        setBusy(false);
      }
    });

  return (
    <PosSheet
      open={open}
      onClose={onClose}
      size="wide"
      icon="ban"
      title={t('cancelItemsTitle', { number: order.dailyNumber })}
      subtitle={t('cancelItemsSubtitle')}
      footer={
        <>
          <span className="pos-ft-sum">
            <small>{t('selectedCount', { count })}</small>
            <b>{formatPrice(value)}</b>
          </span>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t('back')}
          </Button>
          <Button
            variant="danger"
            size="lg"
            disabled={!canSubmit}
            loading={busy}
            onClick={() => void submit()}
          >
            {!busy && <Icon name="ban" />}
            {t('cancelItemsConfirm', { count })}
          </Button>
        </>
      }
    >
      <div className="pos-oh-form">
        <div className="pos-row pos-row--wrap">
          <Button
            variant="ghost"
            onClick={() =>
              setQty(
                all ? {} : Object.fromEntries(items.map((i) => [i.id, cancellableQuantity(i)]))
              )
            }
          >
            <Icon name={all ? 'x' : 'check'} />
            {all ? t('selectNone') : t('selectAll')}
          </Button>
        </div>
        <ul className="pos-oh-pick">
          {items.map((item) => {
            const max = cancellableQuantity(item);
            const value = qty[item.id] ?? 0;
            return (
              <li key={item.id} className={value > 0 ? 'is-selected is-cancel' : undefined}>
                <span className="pos-oh-pick__main">
                  <b>
                    {item.quantity}x {item.productName}
                  </b>
                  <span className="pos-row pos-row--wrap">
                    <Badge tone={ITEM_STATUS_TONE[item.status]}>
                      {t(`itemStatus.${item.status}`)}
                    </Badge>
                    <small>{formatPrice(item.unitPrice + item.optionsPrice)}</small>
                  </span>
                </span>
                <Stepper
                  size="lg"
                  value={value}
                  min={0}
                  max={max}
                  onDecrement={() => setQty((q) => ({ ...q, [item.id]: Math.max(0, value - 1) }))}
                  onIncrement={() => setQty((q) => ({ ...q, [item.id]: Math.min(max, value + 1) }))}
                  labels={{ decrease: t('less'), increase: t('more') }}
                />
              </li>
            );
          })}
        </ul>

        {started.length > 0 && (
          <Banner tone="danger" icon={<Icon name="alert" />} title={t('startedTitle')}>
            <p>{t('startedText', { items: started.map((i) => i.productName).join(', ') })}</p>
            <Checkbox
              checked={confirmStarted}
              onChange={(e) => setConfirmStarted(e.target.checked)}
            >
              {t('startedConfirm')}
            </Checkbox>
          </Banner>
        )}

        <div className="pos-oh-reason">
          <small>{needsReason ? t('reasonRequired') : t('reasonOptional')}</small>
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
      </div>
    </PosSheet>
  );
}
