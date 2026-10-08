'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, Segment } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useRefundForm } from '@/hooks/use-refund-form';
import { ordersApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';
import { type OrderDetail, REFUND_REASON_CODES, type RefundReasonCode, type RefundResult } from '@/types/order-history';
import { paymentIcon, paymentKey } from '@/utils/order-history';
import type { RefundMode, RefundPreset } from '@/utils/refund-form';

import { QtyStepper, ReasonFields, StartedWarning, muted } from './order-action-parts';

interface OrderRefundDialogProps {
  organizationId: string;
  order: OrderDetail;
  /** `null` = geschlossen. */
  preset: RefundPreset | null;
  onClose: () => void;
  /** Nach einer gebuchten Erstattung (Detail und Liste neu laden). */
  onDone: () => void;
}

type Step = 'form' | 'confirm' | 'result';

interface ProviderFailure {
  message: string | null;
}

/**
 * Erstatten in der Verwaltung — dieselben Regeln wie an der Kasse
 * (gemeinsame Formularlogik `useRefundForm`): Positionen/Mengen, Betrag
 * oder alles, optional zugleich stornieren; Grund ist Pflicht. Rückgabe je
 * ursprünglicher Zahlart: bar wird als „bar ausgezahlt“ gebucht, SumUp
 * über die SumUp-API (bei Ablehnung erneut oder „manuell erstattet“),
 * fremdes Kartengerät manuell. Vor dem Buchen ein Bestätigungsschritt.
 */
export function OrderRefundDialog({ organizationId, order, preset, onClose, onDone }: OrderRefundDialogProps) {
  const t = useTranslations('orders.refund');
  const tHistory = useTranslations('orders.history');
  const tCommon = useTranslations('common');
  const { formatCurrency } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();

  const form = useRefundForm(order, preset);
  const { mode, cancelItems, qty, amount, includeDeposit, paymentId, confirmStarted } = form.state;
  const { payments, maxAmount, methodPayment, method, items, started, hasDeposit, preview, amountInvalid } = form.view;

  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<ProviderFailure | null>(null);
  const [result, setResult] = useState<RefundResult | null>(null);

  useEffect(() => {
    if (!preset) return;
    setStep('form');
    setError(null);
    setFailure(null);
    setResult(null);
  }, [preset]);

  if (!preset) return null;

  const submit = async (manual: boolean) => {
    const body = form.payload(manual);
    setBusy(true);
    setError(null);
    setFailure(null);
    try {
      const res = await ordersApi.createRefund(organizationId, order.id, {
        ...body,
        clientRequestId: form.clientRequestId(body),
      });
      setResult(res.data);
      setStep('result');
      onDone();
    } catch (err) {
      const reason = err instanceof ApiException ? err.reason : undefined;
      if (reason === 'REFUND_PROVIDER_FAILED' && err instanceof ApiException) {
        setFailure({
          message:
            (err.params?.providerMessage as string | undefined) ??
            (err.params?.providerError as string | undefined) ??
            null,
        });
      } else {
        setError(apiErrorMessage(err));
      }
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  const title = cancelItems
    ? t('cancelAndRefundTitle', { number: order.dailyNumber })
    : t('title', { number: order.dailyNumber });

  return (
    <div className="modal__overlay" onClick={busy ? undefined : onClose}>
      <ModalPanel titleId="order-refund-title" className="modal__panel--md">
        <div className="modal__head">
          <div>
            <h2 id="order-refund-title" style={{ margin: 0 }}>
              {step === 'result' ? t('doneTitle') : step === 'confirm' ? t('confirmTitle') : title}
            </h2>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {step === 'result' && result
                ? result.refunds.map((r) => r.refundNumber).join(', ')
                : t('refundable', { amount: formatCurrency(order.refundable) })}
            </div>
          </div>
          <DialogCloseButton onClick={busy ? () => undefined : onClose} />
        </div>

        {step === 'result' && result ? (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>
                {formatCurrency(Math.abs(result.refunds.reduce((s, r) => s + r.amount, 0)))}
              </div>
              {result.refunds.map((r) => (
                <p key={r.id} className="order-action__line">
                  <Icon name={paymentIcon(r.paymentMethod)} size={16} />
                  {r.status === 'test'
                    ? t('result.test')
                    : r.status === 'manual'
                      ? t('result.manual', { amount: formatCurrency(Math.abs(r.amount)) })
                      : r.paymentMethod === 'cash'
                        ? t('result.cash', { amount: formatCurrency(Math.abs(r.amount)) })
                        : t('result.sumup', { amount: formatCurrency(Math.abs(r.amount)) })}
                </p>
              ))}
              <p className="order-action__line" style={result.refunds.every((r) => r.printed) ? undefined : { color: 'var(--danger)' }}>
                <Icon name="printer" size={16} />
                {result.refunds.every((r) => r.printed) ? t('result.printed') : t('result.notPrinted')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {tCommon('close')}
              </button>
            </div>
          </>
        ) : step === 'confirm' ? (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                {cancelItems ? t('confirmCancelText', { amount: formatCurrency(preview) }) : t('confirmText', { amount: formatCurrency(preview) })}
              </p>
              {method && (
                <p className="order-action__line">
                  <Icon name={methodPayment ? paymentIcon(methodPayment.paymentMethod) : 'cash'} size={16} />
                  {t(`method.${method}`)}
                </p>
              )}
              <p className="order-action__line" style={{ color: muted }}>
                <Icon name="printer" size={16} />
                {t('confirmReceipt')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setStep('form')} disabled={busy}>
                {t('back')}
              </button>
              <button
                type="button"
                className={cancelItems ? 'btn btn--danger' : 'btn btn--primary'}
                onClick={() => void submit(false)}
                disabled={busy}
              >
                <Icon name={cancelItems ? 'ban' : 'undo'} size={16} />
                {busy ? t('booking') : cancelItems ? t('confirmCancelAction') : t('confirmAction')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="auth-field">
                <span className="auth-field__label">{t('mode')}</span>
                <Segment<RefundMode>
                  aria-label={t('mode')}
                  value={mode}
                  onChange={(next) => {
                    form.set('mode', next);
                    setFailure(null);
                  }}
                  options={[
                    { id: 'items', label: t('modeItems') },
                    { id: 'amount', label: t('modeAmount'), disabled: cancelItems },
                    { id: 'full', label: t('modeFull') },
                  ]}
                />
              </div>

              {mode !== 'amount' && (
                <label className="order-action__check">
                  <input
                    type="checkbox"
                    checked={cancelItems}
                    onChange={(e) => form.set('cancelItems', e.target.checked)}
                  />
                  <span>
                    <b>{t('alsoCancel')}</b>
                    <small>{t('alsoCancelHint')}</small>
                  </span>
                </label>
              )}

              {mode === 'items' && (
                <div className="auth-field">
                  <span className="auth-field__label">{t('items')}</span>
                  {items.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: muted }}>{t('nothingToSelect')}</p>
                  ) : (
                    <ul className="order-action__items">
                      {items.map(({ item, max }) => {
                        const value = qty[item.id] ?? 0;
                        return (
                          <li key={item.id} className={value > 0 ? (cancelItems ? 'is-cancel' : 'is-selected') : undefined}>
                            <span className="order-action__item">
                              <b>
                                {item.quantity}x {item.productName}
                              </b>
                              <small>
                                {tHistory(`itemStatus.${item.status}`)} · {t('perUnit', { amount: formatCurrency(item.unitRefund) })}
                                {item.depositAmount > 0 ? ` + ${t('deposit', { amount: formatCurrency(item.depositAmount) })}` : ''}
                              </small>
                            </span>
                            <QtyStepper
                              value={value}
                              max={max}
                              label={item.productName}
                              onChange={(next) => form.setQty(item.id, next, max)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {mode === 'items' && !cancelItems && hasDeposit && (
                <label className="order-action__check">
                  <input
                    type="checkbox"
                    checked={includeDeposit}
                    onChange={(e) => form.set('includeDeposit', e.target.checked)}
                  />
                  <span>
                    <b>{t('includeDeposit')}</b>
                  </span>
                </label>
              )}

              {mode === 'amount' && (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="refund-amount">
                    {t('amount')}
                  </label>
                  <input
                    id="refund-amount"
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => form.set('amount', e.target.value.replace(/[^0-9.,]/g, ''))}
                    aria-invalid={!!amount && amountInvalid}
                  />
                  <small style={{ fontSize: 12, color: amount && amountInvalid ? 'var(--danger)' : muted }}>
                    {amount && amountInvalid
                      ? t('amountInvalid', { max: formatCurrency(maxAmount) })
                      : t('amountHint', { max: formatCurrency(maxAmount) })}
                  </small>
                </div>
              )}

              {mode === 'full' && (
                <p style={{ margin: 0, fontSize: 13, color: muted }}>
                  {cancelItems
                    ? t('fullCancelHint', { amount: formatCurrency(order.refundable) })
                    : t('fullRefundHint', { amount: formatCurrency(order.refundable) })}
                </p>
              )}

              {started.length > 0 && (
                <StartedWarning
                  items={started.map((i) => i.productName)}
                  checked={confirmStarted}
                  onChange={(checked) => form.set('confirmStarted', checked)}
                />
              )}

              {payments.length > 1 && (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="refund-payment">
                    {t('via')}
                  </label>
                  <select
                    id="refund-payment"
                    className="select"
                    value={paymentId}
                    onChange={(e) => form.set('paymentId', e.target.value)}
                  >
                    <option value="auto">{t('viaAuto')}</option>
                    {payments.map((p) => (
                      <option key={p.id} value={p.id}>
                        {tHistory(`payment.${paymentKey(p.paymentMethod)}`)} · {t('refundable', { amount: formatCurrency(p.refundable) })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {method && (
                <p className="order-action__line">
                  <Icon name={methodPayment ? paymentIcon(methodPayment.paymentMethod) : 'cash'} size={16} />
                  {t(`methodHint.${method}`)}
                </p>
              )}

              <ReasonFields
                required
                reasonCode={form.state.reasonCode}
                reasonText={form.state.reasonText}
                onReasonCode={(code: RefundReasonCode | null) => form.set('reasonCode', code)}
                onReasonText={(text) => form.set('reasonText', text)}
                codes={REFUND_REASON_CODES}
              />

              {failure && (
                <div role="alert" className="order-action__alert">
                  <b>{t('sumupFailedTitle')}</b>
                  <span>{failure.message || t('sumupFailedText')}</span>
                  <span>{t('sumupManualHint')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void submit(false)}>
                      <Icon name="refresh" size={14} />
                      {t('retry')}
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => void submit(true)}>
                      <Icon name="check" size={14} />
                      {t('markManual')}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" className="order-action__alert">
                  {error}
                </div>
              )}
            </div>

            <div className="modal__foot">
              <span className="order-action__sum">
                <small>{t('sum')}</small>
                <b className="mono">{formatCurrency(preview)}</b>
              </span>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className={cancelItems ? 'btn btn--danger' : 'btn btn--primary'}
                disabled={!form.view.ready || busy}
                onClick={() => setStep('confirm')}
              >
                <Icon name={cancelItems ? 'ban' : 'undo'} size={16} />
                {cancelItems ? t('cancelAndRefundAction') : t('action')}
              </button>
            </div>
          </>
        )}
      </ModalPanel>
    </div>
  );
}
