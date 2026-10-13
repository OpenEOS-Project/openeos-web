'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, CircleAlert, Undo2 } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCancelEventUnlock, useEventBilling } from '@/hooks/use-events';
import { useIntlLocale } from '@/hooks/use-locale-format';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { formatCurrency } from '@/utils/format';
import { describeEventUnlock, formatUnlockDeadline } from '@/utils/event-unlock';
import type { Event } from '@/types/event';

interface EventUnlockDialogProps {
  event: Event | null;
  organizationId: string;
  onClose: () => void;
}

const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

const panelStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  padding: '12px 14px',
  background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
  border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
  borderRadius: 10,
};

/**
 * Freischaltung einer Veranstaltung: Status, bezahlter Betrag, Stornofrist
 * und — solange die Frist läuft — der Weg zurück.
 *
 * Zweistufig, weil Stornieren Geld bewegt: erst die Übersicht, dann eine
 * eigene Bestätigung, die Betrag, Rückweg und Folgen noch einmal nennt.
 */
export function EventUnlockDialog({ event, organizationId, onClose }: EventUnlockDialogProps) {
  const t = useTranslations('events.unlock');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const apiErrorMessage = useApiErrorMessage();
  const locale = useIntlLocale();

  const { data: billing, isLoading, isError, refetch } = useEventBilling(organizationId, event?.id ?? null);
  const cancelUnlock = useCancelEventUnlock();

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirming(false);
    setError(null);
  }, [event?.id]);

  if (!event) return null;

  const view = billing ? describeEventUnlock(billing) : null;
  const amount = billing ? formatCurrency(billing.priceCharged ?? billing.finalPrice, locale) : '';
  const deadlineLabel = (iso: string | null) =>
    iso && billing ? formatUnlockDeadline(iso, locale, billing.cancellation.timezone) : '';
  const dateFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleCancel = async () => {
    setError(null);
    try {
      const result = await cancelUnlock.mutateAsync({ organizationId, id: event.id });
      const refunded = formatCurrency(result.cancellation.amount, locale);
      toast.success(
        result.cancellation.previousBillingStatus === 'paid'
          ? t('toast.refunded', { amount: refunded })
          : t('toast.cancelled'),
      );
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, tErrors('generic')));
      // Die Lage kann sich geändert haben (Frist, neue Bestellung) — neu laden.
      void refetch();
    }
  };

  const statusLabel = (() => {
    if (!view || !billing) return '';
    switch (view.kind) {
      case 'cancellable':
      case 'locked':
        return view.via === 'stripe' ? t('status.paid') : t('status.invoice');
      case 'waived':
        return t('status.waived');
      default:
        return billing.lastCancellation ? t('status.cancelled') : t('status.none');
    }
  })();

  const lockedText = (() => {
    if (!view || view.kind !== 'locked') return null;
    switch (view.reason) {
      case 'has_orders':
        return t('locked.hasOrders');
      case 'online_refund_unavailable':
        return t('locked.refundUnavailable');
      case 'deadline_passed':
      default:
        return view.deadline
          ? t('locked.deadlinePassed', { deadline: deadlineLabel(view.deadline) })
          : t('locked.deadlinePassedNoDate');
    }
  })();

  const isSubmitting = cancelUnlock.isPending;

  return (
    <div className="modal__overlay" onClick={isSubmitting ? undefined : onClose}>
      <ModalPanel titleId="event-unlock-dialog-title" className="modal__panel--md">
        <div className="modal__head">
          <h2 id="event-unlock-dialog-title">{confirming ? t('confirm.title') : t('title')}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{event.name}</div>
            {event.startDate && (
              <div style={{ fontSize: 12, color: MUTED }}>{dateFormat.format(new Date(event.startDate))}</div>
            )}
          </div>

          {isLoading && <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{tCommon('loading')}</p>}
          {isError && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>
              {tErrors('generic')}
            </div>
          )}

          {billing && view && !confirming && (
            <>
              <div style={panelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BadgeCheck
                    size={16}
                    aria-hidden="true"
                    style={{ color: view.kind === 'not_unlocked' ? MUTED : 'var(--green-ink)' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }} data-testid="unlock-status">
                    {statusLabel}
                  </span>
                </div>
                {(view.kind === 'cancellable' || view.kind === 'locked') && (
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {billing.paidAt
                      ? t(view.via === 'stripe' ? 'paidAmountOn' : 'orderedAmountOn', {
                          amount,
                          date: dateFormat.format(new Date(billing.paidAt)),
                        })
                      : t(view.via === 'stripe' ? 'paidAmount' : 'orderedAmount', { amount })}
                  </div>
                )}
                {view.kind === 'not_unlocked' && billing.lastCancellation && (
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {t('lastCancellation', {
                      date: dateFormat.format(new Date(billing.lastCancellation.cancelledAt)),
                      amount: formatCurrency(billing.lastCancellation.amount, locale),
                    })}
                    {billing.lastCancellation.creditNoteNumber &&
                      ` ${t('creditNote', { number: billing.lastCancellation.creditNoteNumber })}`}
                  </div>
                )}
              </div>

              {view.kind === 'cancellable' && (
                <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }} data-testid="unlock-deadline">
                  {t('deadline', { deadline: deadlineLabel(view.deadline) })}
                </p>
              )}

              {lockedText && (
                <div
                  role="status"
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
                  <span>{lockedText}</span>
                </div>
              )}

              {view.kind === 'waived' && (
                <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{t('waivedNote')}</p>
              )}
            </>
          )}

          {billing && view?.kind === 'cancellable' && confirming && (
            <>
              <div style={panelStyle}>
                <div style={{ fontSize: 13, color: MUTED }}>{t('confirm.amountLabel')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{amount}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{t('confirm.wayBackTitle')}</strong>
                <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>
                  {view.via === 'stripe' ? t('confirm.wayBackStripe') : t('confirm.wayBackInvoice')}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{t('confirm.consequencesTitle')}</strong>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink)', display: 'grid', gap: 4 }}>
                  <li>{t('confirm.consequenceTestMode')}</li>
                  <li>{t('confirm.consequenceReactivate')}</li>
                  {billing.billingEmail && <li>{t('confirm.consequenceEmail', { email: billing.billingEmail })}</li>}
                </ul>
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'color-mix(in oklab, var(--danger) 10%, var(--paper))',
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal__foot">
          {confirming ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirming(false)}
                disabled={isSubmitting}
              >
                {t('confirm.back')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--error, var(--danger))' }}
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('confirm.submitting') : t('confirm.submit')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {tCommon('close')}
              </button>
              {view?.kind === 'cancellable' && (
                <button
                  type="button"
                  className="btn btn--danger-quiet"
                  onClick={() => {
                    setError(null);
                    setConfirming(true);
                  }}
                >
                  <Undo2 size={15} aria-hidden="true" />
                  {t('cancelButton')}
                </button>
              )}
            </>
          )}
        </div>
      </ModalPanel>
    </div>
  );
}
