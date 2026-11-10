'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { SettlementFigures } from '@/components/waiters/settlement-figures';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePrinters } from '@/hooks/use-printers';
import { useSettleWaiter, useTipPayoutStatus, useTransferWaiterTables, useWaiterSummary } from '@/hooks/use-waiters';
import { canPayOutCardTips, settlementBlocked } from '@/lib/waiters';
import { ApiException } from '@/types/api';
import type { Waiter, WaiterSettlement } from '@/types/waiter';

interface WaiterSettleModalProps {
  organizationId: string;
  waiter: Waiter;
  /** Mögliche Empfänger einer Tischübergabe (aktive Bedienungen). */
  waiters: Waiter[];
  onClose: () => void;
  onSettled: (settlement: WaiterSettlement) => void;
}

/**
 * Zwischenstand und Abrechnung einer Bedienung in der Verwaltung
 * (bedienungen-plan.md §7): Zahlen seit der letzten Abrechnung, offene
 * Tische übergeben oder mit Notiz trotzdem abrechnen, Bon optional auf
 * einem Drucker.
 */
export function WaiterSettleModal({ organizationId, waiter, waiters, onClose, onSettled }: WaiterSettleModalProps) {
  const t = useTranslations('waiterSettlement');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const summary = useWaiterSummary(organizationId, waiter.id);
  const settle = useSettleWaiter(organizationId);
  const transfer = useTransferWaiterTables(organizationId);
  const { data: printers = [] } = usePrinters(organizationId);
  const receiptPrinters = printers.filter((p) => p.isActive);

  const [target, setTarget] = useState('');
  const [force, setForce] = useState(false);
  const [note, setNote] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [payOutTips, setPayOutTips] = useState(false);
  // Kartentrinkgeld: nur Arbeitnehmer (Lohnkonto) bekommen es ausgezahlt.
  const tipStatus = useTipPayoutStatus(organizationId, waiter.id, waiter.isEmployee === true);
  const openCardTips = tipStatus.data?.isEmployee ? tipStatus.data.openCardTips : null;
  const offerTipPayout = canPayOutCardTips(openCardTips);

  const data = summary.data;
  const openTables = data?.openTables ?? [];
  const targets = waiters.filter(
    (w) => w.id !== waiter.id && w.isActive && !w.anonymizedAt && (!w.eventId || w.eventId === data?.eventId),
  );
  const blocked = settlementBlocked(openTables.length, force, note);

  const handOver = () => {
    if (!target) return;
    transfer.mutate(
      { waiterId: waiter.id, toWaiterId: target, eventId: data?.eventId },
      {
        onSuccess: (result) => {
          toast.success(t('toast.transferred', { count: result.orderIds.length, name: result.toWaiter.name }));
          void summary.refetch();
        },
        onError: (error) => toast.error(apiErrorMessage(error, tCommon('saveFailed'))),
      },
    );
  };

  const submit = () => {
    settle.mutate(
      {
        waiterId: waiter.id,
        data: {
          eventId: data?.eventId,
          force: openTables.length > 0 ? force : undefined,
          note: note.trim() || null,
          printerId: printerId || undefined,
          ...(offerTipPayout && payOutTips ? { payOutCardTips: true } : {}),
        },
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.data.number
              ? t('toast.settled', { number: result.data.number, name: waiter.name })
              : t('toast.settledTraining', { name: waiter.name }),
          );
          if (printerId && result.meta && !result.meta.printed) toast.error(t('toast.notPrinted'));
          if (result.meta?.tipPayout) {
            toast.success(t('tipPayout.paid', { amount: formatCurrency(result.meta.tipPayout.amount), name: waiter.name }));
          }
          onSettled(result.data);
        },
        onError: (error) => {
          if (error instanceof ApiException && error.reason === 'WAITER_OPEN_TABLES') void summary.refetch();
          toast.error(apiErrorMessage(error, tCommon('saveFailed')));
        },
      },
    );
  };

  let body;
  if (summary.isLoading) body = <p className="settle-period">{tCommon('loading')}</p>;
  else if (summary.error || !data)
    body = <p className="waiters-form__error">{apiErrorMessage(summary.error, t('errors.summary'))}</p>;
  else
    body = (
      <div className="waiters-form">
        <p className="settle-period" data-testid="settle-period">
          {data.eventName ? `${data.eventName} · ` : ''}
          {data.periodFrom
            ? t('period.since', {
                from: formatDateTime(data.periodFrom),
                number: data.lastSettlement?.number ?? '–',
              })
            : t('period.start')}
        </p>
        {data.empty ? (
          <p className="waiters-form__hint">{t('empty')}</p>
        ) : (
          <SettlementFigures totals={data.totals} />
        )}

        {openTables.length > 0 && (
          <div className="settle-open" data-testid="settle-open-tables">
            <h3>{t('openTables.title', { count: openTables.length })}</h3>
            <ul>
              {openTables.map((o) => (
                <li key={o.orderId}>
                  {o.tableNumber ? t('openTables.table', { table: o.tableNumber }) : `#${o.dailyNumber ?? o.orderNumber}`}
                  {o.openAmount !== undefined && <span className="settle-open__amount">{formatCurrency(o.openAmount)}</span>}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label={t('openTables.target')}
                style={{ flex: '1 1 180px' }}
              >
                <option value="">{t('openTables.target')}</option>
                {targets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handOver}
                disabled={!target || transfer.isPending}
              >
                {t('openTables.handOver')}
              </button>
            </div>
            <div className="settle-force">
              <label>
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                <span>{t('force.label')}</span>
              </label>
              {force && (
                <textarea
                  className="input"
                  value={note}
                  maxLength={500}
                  placeholder={t('force.notePlaceholder')}
                  aria-label={t('force.note')}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {offerTipPayout && openCardTips !== null && (
          <div className="settle-tips" data-testid="settle-tip-payout">
            <label>
              <input type="checkbox" checked={payOutTips} onChange={(e) => setPayOutTips(e.target.checked)} />
              <span>{t('tipPayout.checkbox', { amount: formatCurrency(openCardTips) })}</span>
            </label>
            <p>{t('tipPayout.checkboxHint')}</p>
          </div>
        )}
        {!waiter.isEmployee && !data.empty && (data.totals.tips ?? 0) > 0 && (
          <p className="waiters-form__hint" data-testid="settle-tips-volunteer">
            {t('tipPayout.volunteerShort')}
          </p>
        )}

        {!data.empty && (
          <label className="auth-field">
            <span>{t('printer')}</span>
            <select className="select" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
              <option value="">{t('noPrint')}</option>
              {receiptPrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="waiter-settle-title">
        <div className="modal__head">
          <h2 id="waiter-settle-title">{t('dashboardTitle', { name: waiter.name })}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body">{body}</div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}
            disabled={!data || data.empty || blocked || settle.isPending}
            data-testid="settle-submit"
          >
            {settle.isPending ? tCommon('saving') : t('submit')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
