'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ListError, ListLoading } from '@/components/shared/list-states';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { SettlementFigures } from '@/components/waiters/settlement-figures';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePrinters } from '@/hooks/use-printers';
import { useReprintSettlement, useWaiterSettlements } from '@/hooks/use-waiters';
import type { WaiterSettlement } from '@/types/waiter';

import { WaiterBadge } from './waiter-badge';

interface WaiterSettlementsSectionProps {
  organizationId: string;
  /** Filter der Seite (Veranstaltung) oder alle. */
  eventId: string | null;
  /** Gerade abgerechnet: direkt öffnen. */
  highlight?: WaiterSettlement | null;
  onCloseHighlight?: () => void;
}

/** „Abrechnungen“ unter Bedienungen: Liste, Einzelansicht, Nachdruck. */
export function WaiterSettlementsSection({ organizationId, eventId, highlight, onCloseHighlight }: WaiterSettlementsSectionProps) {
  const t = useTranslations('waiterSettlement');
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const list = useWaiterSettlements(organizationId, eventId ? { eventId } : undefined);
  const [open, setOpen] = useState<WaiterSettlement | null>(null);
  const shown = open ?? highlight ?? null;
  const settlements = list.data ?? [];

  const close = () => {
    setOpen(null);
    onCloseHighlight?.();
  };

  let body;
  if (list.isLoading) body = <ListLoading />;
  else if (list.error) body = <ListError />;
  else if (settlements.length === 0)
    body = (
      <p className="waiters-form__hint" style={{ padding: '0 20px 20px' }}>
        {t('list.empty')}
      </p>
    );
  else
    body = (
      <div className="waiters-table" style={{ overflowX: 'auto' }}>
        <table className="data-table" data-testid="waiter-settlements-table">
          <thead>
            <tr>
              <th>{t('list.number')}</th>
              <th>{t('list.waiter')}</th>
              <th>{t('list.period')}</th>
              <th className="text-right">{t('list.collected')}</th>
              <th className="text-right">{t('list.cashExpected')}</th>
              <th>{t('list.settledBy')}</th>
              <th>{t('list.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id}>
                <td className="mono">
                  {s.number ? `Nr. ${s.number}` : <span className="badge badge--neutral">{t('list.training')}</span>}
                  {s.forced && (
                    <span className="badge badge--warning" style={{ marginLeft: 6 }} title={s.note ?? undefined}>
                      {t('list.forced')}
                    </span>
                  )}
                </td>
                <td>
                  <div className="waiters-name">
                    <WaiterBadge name={s.subject.name} color={s.subject.color} />
                    <span>
                      <b>{s.subject.name}</b>
                      {s.eventName && <small>{s.eventName}</small>}
                    </span>
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {s.periodFrom ? formatDateTime(s.periodFrom) : t('list.fromStart')} – {formatDateTime(s.periodTo)}
                </td>
                <td className="mono text-right">
                  {s.totals.payments ? formatCurrency(s.totals.payments.total.amount) : '—'}
                </td>
                <td className="mono text-right">{s.cashExpected === null ? '—' : formatCurrency(s.cashExpected)}</td>
                <td style={{ fontSize: 13 }}>
                  {s.settledBy?.name ?? '—'}
                  {s.deviceName && <small style={{ display: 'block', opacity: 0.6 }}>{s.deviceName}</small>}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setOpen(s)}
                    aria-label={t('list.open', { number: s.number ?? '–' })}
                    title={t('list.open', { number: s.number ?? '–' })}
                  >
                    <Icon name="eye" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <section className="app-card app-card--flat" aria-labelledby="waiter-settlements-title" data-testid="waiter-settlements">
      <div className="app-card__head">
        <div>
          <h2 id="waiter-settlements-title" className="waiters-settings__title">
            {t('list.title')}
          </h2>
          <p className="waiters-form__hint">{t('list.description')}</p>
        </div>
      </div>
      {body}
      {shown && <SettlementDetailModal organizationId={organizationId} settlement={shown} onClose={close} />}
    </section>
  );
}

function SettlementDetailModal({
  organizationId,
  settlement,
  onClose,
}: {
  organizationId: string;
  settlement: WaiterSettlement;
  onClose: () => void;
}) {
  const t = useTranslations('waiterSettlement');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const { data: printers = [] } = usePrinters(organizationId);
  const reprint = useReprintSettlement(organizationId);
  const [printerId, setPrinterId] = useState('');

  const doReprint = () =>
    reprint.mutate(
      { settlementId: settlement.id, printerId: printerId || undefined },
      {
        onSuccess: (result) => (result.printed ? toast.success(t('toast.reprinted')) : toast.error(t('toast.notPrinted'))),
        onError: (error) => toast.error(apiErrorMessage(error, tCommon('saveFailed'))),
      },
    );

  const title = settlement.number
    ? t('detail.title', { number: settlement.number })
    : t('detail.trainingTitle');

  return (
    <div className="modal__overlay" onClick={onClose}>
      <ModalPanel titleId="settlement-detail-title">
        <div className="modal__head">
          <h2 id="settlement-detail-title">{title}</h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="modal__body">
          <div className="waiters-form" data-testid="settlement-detail">
            <p className="settle-period">
              <b>{settlement.subject.name}</b>
              {settlement.eventName ? ` · ${settlement.eventName}` : ''}
              <br />
              {settlement.periodFrom ? formatDateTime(settlement.periodFrom) : t('list.fromStart')} –{' '}
              {formatDateTime(settlement.periodTo)}
              <br />
              {t('detail.settledBy', {
                name: settlement.settledBy?.name ?? '—',
                device: settlement.deviceName ?? t('detail.dashboard'),
              })}
            </p>
            <SettlementFigures
              totals={settlement.totals}
              cashCounted={settlement.cashCounted}
              difference={settlement.difference}
            />
            {settlement.openTables.length > 0 && (
              <div className="settle-open">
                <h3>
                  {settlement.forced ? t('detail.forced') : t('openTables.title', { count: settlement.openTables.length })}
                </h3>
                <ul>
                  {settlement.openTables.map((o) => (
                    <li key={o.orderId}>
                      {o.tableNumber ? t('openTables.table', { table: o.tableNumber }) : `#${o.dailyNumber ?? o.orderNumber}`}
                      {o.openAmount !== undefined && <span className="settle-open__amount">{formatCurrency(o.openAmount)}</span>}
                    </li>
                  ))}
                </ul>
                {settlement.note && <p className="waiters-form__hint">{t('detail.note', { note: settlement.note })}</p>}
              </div>
            )}
            <label className="auth-field">
              <span>{t('printer')}</span>
              <select className="select" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
                <option value="">{t('detail.devicePrinter')}</option>
                {printers
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {tCommon('close')}
          </button>
          <button type="button" className="btn btn--primary" onClick={doReprint} disabled={reprint.isPending}>
            <Icon name="print" size={16} />
            {t('detail.reprint')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
