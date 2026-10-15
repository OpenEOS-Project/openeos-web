'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useCancelEventBilling, useCancelEventBillingPreview } from '@/hooks/use-admin-events';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { formatCurrency } from '@/utils/format';
import { formatUnlockDeadline } from '@/utils/event-unlock';
import { planPlatformRefund, type PlatformRefundMode } from '@/utils/platform-refund';
import type { AdminEventListItem } from '@/types/admin';

const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

interface CancelBillingModalProps {
  event: AdminEventListItem;
  onClose: () => void;
}

/**
 * Storno bzw. Kulanzerstattung durch die Plattform.
 *
 * Anders als die Organisation darf der Super-Admin alles: ohne Frist, auch
 * bei echten Bestellungen, ganz oder teilweise — mit Begründung. Mit echten
 * Bestellungen oder bei einem Teilbetrag ist es Kulanz: die Freischaltung,
 * der Status der Veranstaltung und alle Bestellungen bleiben. Nur der volle
 * Betrag ohne echte Bestellungen hebt die Freischaltung auf.
 */
export function CancelBillingModal({ event, onClose }: CancelBillingModalProps) {
  const t = useTranslations('admin.events.cancelBilling');
  const tRoot = useTranslations();
  const locale = useLocale();
  const preview = useCancelEventBillingPreview(event.id);
  const cancelBilling = useCancelEventBilling();
  const apiErrorMessage = useApiErrorMessage();
  const [mode, setMode] = useState<PlatformRefundMode>('full');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const data = preview.data;
  const money = (value: number) => formatCurrency(value, locale);
  const plan = data ? planPlatformRefund(data, { mode, amountText, reason }) : null;

  function handleConfirm() {
    if (!plan || plan.problem) return;
    setError(null);
    cancelBilling.mutate(
      { id: event.id, reason: reason.trim(), amount: plan.payloadAmount },
      {
        onSuccess: onClose,
        onError: (err) => setError(apiErrorMessage(err, tRoot('errors.generic'))),
      },
    );
  }

  const problemText = (() => {
    if (!plan?.problem || !data) return null;
    switch (plan.problem) {
      case 'nothing_refundable':
        return t('problems.nothingRefundable');
      case 'online_refund_unavailable':
        return t('problems.onlineRefundUnavailable');
      case 'amount_too_high':
        return t('problems.amountTooHigh', { max: money(data.refundable) });
      case 'amount_invalid':
        return amountText.trim() ? t('problems.amountInvalid') : null;
      default:
        return null;
    }
  })();

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        className="modal__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-billing-title"
        data-testid="cancel-billing-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <div className="modal__title" id="cancel-billing-title">{t('title')}</div>
            <div className="modal__sub">{event.name} — {event.organizationName}</div>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {preview.isLoading && <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{tRoot('common.loading')}</p>}
          {preview.isError && (
            <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>
              {apiErrorMessage(preview.error, tRoot('errors.generic'))}
            </p>
          )}

          {data && plan && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                  background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <Fact label={t(data.via === 'invoice' ? 'facts.orderedInvoice' : 'facts.paidStripe')} value={money(data.amountCharged)} />
                {data.refundedSoFar > 0 && (
                  <Fact label={t('facts.refundedSoFar')} value={money(data.refundedSoFar)} />
                )}
                <Fact label={t('facts.refundable')} value={money(data.refundable)} testId="cancel-billing-refundable" />
                <Fact label={t('facts.realOrders')} value={String(data.realOrders)} />
              </div>

              {data.realOrders > 0 && (
                <div
                  role="status"
                  data-testid="cancel-billing-orders-warning"
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'color-mix(in oklab, var(--warn) 18%, var(--paper))',
                    fontSize: 13,
                    color: 'var(--ink)',
                  }}
                >
                  <TriangleAlert size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--warn-ink)' }} />
                  <span>{t('ordersWarning', { count: data.realOrders })}</span>
                </div>
              )}

              {data.deadline && data.deadlinePassed && (
                <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                  {t('deadlinePassed', {
                    deadline: formatUnlockDeadline(data.deadline, locale, data.timezone),
                  })}
                </p>
              )}

              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <legend className="auth-field__label" style={{ marginBottom: 6 }}>{t('amountLabel')}</legend>
                <ModeOption
                  name="cancel-billing-mode"
                  checked={mode === 'full'}
                  onChange={() => setMode('full')}
                  title={t('modeFull', { amount: money(data.refundable) })}
                  testId="cancel-billing-mode-full"
                />
                <ModeOption
                  name="cancel-billing-mode"
                  checked={mode === 'partial'}
                  onChange={() => setMode('partial')}
                  title={t('modePartial')}
                  testId="cancel-billing-mode-partial"
                />
                {mode === 'partial' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28 }}>
                    <input
                      id="cancel-billing-amount"
                      className="input"
                      inputMode="decimal"
                      autoFocus
                      aria-label={t('amountInput')}
                      data-testid="cancel-billing-amount"
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      placeholder={new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(data.refundable)}
                      style={{ maxWidth: 140 }}
                    />
                    <span style={{ fontSize: 13, color: MUTED }}>{data.currency}</span>
                  </div>
                )}
              </fieldset>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="cancel-billing-reason">
                  {t('reasonLabel')}
                </label>
                <textarea
                  id="cancel-billing-reason"
                  className="textarea"
                  rows={3}
                  required
                  maxLength={1000}
                  data-testid="cancel-billing-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('reasonPlaceholder')}
                />
              </div>

              <div
                data-testid="cancel-billing-outcome"
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
                  fontSize: 13,
                  color: 'var(--ink)',
                }}
              >
                <CircleAlert size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {plan.keepsUnlock ? t('outcomeGoodwill') : t('outcomeCancellation')}{' '}
                  {data.via === 'invoice'
                    ? t(data.invoiced ? 'refundInvoiceInvoiced' : 'refundInvoiceOpen')
                    : t('refundStripe')}
                </span>
              </div>

              {problemText && (
                <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>
                  {problemText}
                </p>
              )}
            </>
          )}

          {error && (
            <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>{tRoot('common.cancel')}</button>
          <button
            className="btn btn--primary"
            style={{ background: 'var(--error, var(--danger))' }}
            onClick={handleConfirm}
            data-testid="cancel-billing-submit"
            disabled={!plan || !!plan.problem || cancelBilling.isPending}
          >
            {cancelBilling.isPending
              ? tRoot('common.saving')
              : plan?.keepsUnlock
                ? t('submitGoodwill', { amount: plan && Number.isFinite(plan.amount) ? money(plan.amount) : '' })
                : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }} data-testid={testId}>{value}</div>
    </div>
  );
}

function ModeOption({
  name,
  checked,
  onChange,
  title,
  testId,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  testId: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${checked ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)'}`,
        background: checked ? 'color-mix(in oklab, var(--green-soft) 35%, var(--paper))' : 'var(--paper)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink)',
      }}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} data-testid={testId} style={{ accentColor: 'var(--green-ink)' }} />
      {title}
    </label>
  );
}
