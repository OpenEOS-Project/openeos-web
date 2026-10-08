'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { ITEM_STATUS_TONE, cancellableQuantity } from '@/utils/order-history';
import { toggleAllCancelItems } from '@/utils/refund-form';
import { Badge, Banner, Button, Checkbox, Chip, Chips, Icon, Stepper, Textarea } from '@openeos/ui';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCancelItemsForm } from '@/hooks/use-refund-form';

import { deviceApi } from '@/lib/api-client';

import { type DeviceActor, type OrderDetail, REFUND_REASON_CODES } from '@/types/order-history';

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
  const form = useCancelItemsForm(order, open);
  const { qty, reasonCode, reasonText, confirmStarted } = form.state;
  const { items, started, all, count, value, needsReason } = form.view;
  const [busy, setBusy] = useState(false);
  const canSubmit = form.view.ready && !busy;

  const submit = () =>
    run(async (actor) => {
      setBusy(true);
      try {
        await deviceApi.cancelOrderItems(order.id, { ...actor, ...form.payload() });
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
          {/* Auf dem Telefon schließt das Blatt über Kreuz/Wischen; der Platz gehört der Aktion. */}
          <Button variant="ghost" size="lg" className="pos-oh-hide-sm" onClick={onClose}>
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
            onClick={() => form.set('qty', toggleAllCancelItems(form.view))}
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
                  onDecrement={() => form.setQty(item.id, value - 1, max)}
                  onIncrement={() => form.setQty(item.id, value + 1, max)}
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
              onChange={(e) => form.set('confirmStarted', e.target.checked)}
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
                onClick={() => form.set('reasonCode', reasonCode === code ? null : code)}
              >
                {t(`reasons.${code}`)}
              </Chip>
            ))}
          </Chips>
          <Textarea
            value={reasonText}
            onChange={(e) => form.set('reasonText', e.target.value)}
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
