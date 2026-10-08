'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useCancelItemsForm } from '@/hooks/use-refund-form';
import { ordersApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';
import { type OrderDetail, REFUND_REASON_CODES } from '@/types/order-history';
import { cancellableQuantity } from '@/utils/order-history';
import { toggleAllCancelItems } from '@/utils/refund-form';

import { QtyStepper, ReasonFields, StartedWarning, muted } from './order-action-parts';

interface OrderCancelItemsDialogProps {
  organizationId: string;
  order: OrderDetail;
  open: boolean;
  onClose: () => void;
  /** Positionen storniert (Detail und Liste neu laden). */
  onDone: (count: number) => void;
  /** Schon bezahlt: weiter zu „Stornieren & erstatten“. */
  onRefundRequired: () => void;
}

/**
 * Positionen einer noch nicht bezahlten Bestellung stornieren — wie an der
 * Kasse (gemeinsame Logik `useCancelItemsForm`). Nicht begonnene
 * Positionen gehen zurück in den Bestand; begonnene nur mit Bestätigung
 * und Grund. Vor dem Buchen ein Bestätigungsschritt.
 */
export function OrderCancelItemsDialog({
  organizationId,
  order,
  open,
  onClose,
  onDone,
  onRefundRequired,
}: OrderCancelItemsDialogProps) {
  const t = useTranslations('orders.refund');
  const tHistory = useTranslations('orders.history');
  const tCommon = useTranslations('common');
  const { formatCurrency } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();

  const form = useCancelItemsForm(order, open);
  const { qty } = form.state;
  const { items, started, all, count, value, needsReason } = form.view;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ordersApi.cancelItems(organizationId, order.id, form.payload());
      onDone(count);
    } catch (err) {
      if (err instanceof ApiException && err.reason === 'ORDER_PAID_REFUND_REQUIRED') {
        onRefundRequired();
        return;
      }
      setError(apiErrorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal__overlay" onClick={busy ? undefined : onClose}>
      <ModalPanel titleId="order-cancel-items-title" className="modal__panel--md">
        <div className="modal__head">
          <div>
            <h2 id="order-cancel-items-title" style={{ margin: 0 }}>
              {confirming ? t('cancelConfirmTitle') : t('cancelTitle', { number: order.dailyNumber })}
            </h2>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{t('cancelSubtitle')}</div>
          </div>
          <DialogCloseButton onClick={busy ? () => undefined : onClose} />
        </div>

        {confirming ? (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14 }}>{t('cancelConfirmText', { count, amount: formatCurrency(value) })}</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {form.view.selected.map((item) => (
                  <li key={item.id}>
                    {qty[item.id]}x {item.productName}
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>
                {t('back')}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => void submit()} disabled={busy}>
                <Icon name="ban" size={16} />
                {busy ? t('booking') : t('cancelAction', { count })}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="auth-field">
                <span className="auth-field__label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {t('items')}
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => form.set('qty', toggleAllCancelItems(form.view))}
                  >
                    {all ? t('selectNone') : t('selectAll')}
                  </button>
                </span>
                <ul className="order-action__items">
                  {items.map((item) => {
                    const max = cancellableQuantity(item);
                    const current = qty[item.id] ?? 0;
                    return (
                      <li key={item.id} className={current > 0 ? 'is-cancel' : undefined}>
                        <span className="order-action__item">
                          <b>
                            {item.quantity}x {item.productName}
                          </b>
                          <small>
                            {tHistory(`itemStatus.${item.status}`)} · {formatCurrency(item.unitPrice + item.optionsPrice)}
                          </small>
                        </span>
                        <QtyStepper
                          value={current}
                          max={max}
                          label={item.productName}
                          onChange={(next) => form.setQty(item.id, next, max)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              {started.length > 0 && (
                <StartedWarning
                  items={started.map((i) => i.productName)}
                  checked={form.state.confirmStarted}
                  onChange={(checked) => form.set('confirmStarted', checked)}
                />
              )}

              <ReasonFields
                required={needsReason}
                reasonCode={form.state.reasonCode}
                reasonText={form.state.reasonText}
                codes={REFUND_REASON_CODES}
                onReasonCode={(code) => form.set('reasonCode', code)}
                onReasonText={(text) => form.set('reasonText', text)}
              />

              {error && (
                <div role="alert" className="order-action__alert">
                  {error}
                </div>
              )}
            </div>

            <div className="modal__foot">
              <span className="order-action__sum">
                <small>{t('selectedCount', { count })}</small>
                <b className="mono">{formatCurrency(value)}</b>
              </span>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={!form.view.ready}
                onClick={() => setConfirming(true)}
              >
                <Icon name="ban" size={16} />
                {t('cancelAction', { count })}
              </button>
            </div>
          </>
        )}
      </ModalPanel>
    </div>
  );
}
