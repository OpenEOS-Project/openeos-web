'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, Segment, type DataColumn } from '@openeos/ui';

import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ListError, ListLoading } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellNone, CellText } from '@/components/shared/admin-table';
import { ModalPanel } from '@/components/shared/modal-panel';
import { toast } from '@/components/shared/toast';
import { SettlementFigures } from '@/components/waiters/settlement-figures';
import { SettlementTseLine } from '@/components/waiters/settlement-tse';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePrinters } from '@/hooks/use-printers';
import { useReprintSettlement, useWaiterSettlements } from '@/hooks/use-waiters';
import type { WaiterSettlement } from '@/types/waiter';

import { WaiterBadge } from './waiter-badge';
import { WaiterLiveAudit } from './waiter-live-audit';

import '@/styles/admin-table-wave2.css';

interface WaiterSettlementsSectionProps {
  organizationId: string;
  /** Filter der Seite (Veranstaltung) oder alle. */
  eventId: string | null;
  /** Gerade abgerechnet: direkt öffnen. */
  highlight?: WaiterSettlement | null;
  onCloseHighlight?: () => void;
}

/**
 * „Abrechnungen“ unter Bedienungen: Liste, Einzelansicht, Kopie drucken —
 * und daneben der Live-Kassensturz (Soll je Bedienung seit der letzten
 * Abrechnung, für eine Kassen-Nachschau).
 */
export function WaiterSettlementsSection({ organizationId, eventId, highlight, onCloseHighlight }: WaiterSettlementsSectionProps) {
  const t = useTranslations('waiterSettlement');
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const list = useWaiterSettlements(organizationId, eventId ? { eventId } : undefined);
  const [open, setOpen] = useState<WaiterSettlement | null>(null);
  const [view, setView] = useState<'settlements' | 'live'>('settlements');
  const shown = open ?? highlight ?? null;
  const settlements = list.data ?? [];

  const close = () => {
    setOpen(null);
    onCloseHighlight?.();
  };

  const columns: DataColumn<WaiterSettlement>[] = [
    {
      id: 'number',
      header: t('list.number'),
      mobile: 'subtitle',
      className: 'waiter-settlements__number',
      cell: (s) => (
        <span className="waiter-settlements__badges">
          {s.number ? <span className="mono">Nr. {s.number}</span> : <span className="badge badge--neutral">{t('list.training')}</span>}
          {s.tse && (
            <span
              className={`badge ${s.tse.failed ? 'badge--warning' : 'badge--success'}`}
              title={s.tse.failed ? t('tse.failed') : t('tse.signedNoNumber')}
            >
              {s.tse.failed ? t('tse.badgeFailed') : t('tse.badge')}
            </span>
          )}
          {s.forced && (
            <span className="badge badge--warning" title={s.note ?? undefined}>
              {t('list.forced')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'waiter',
      header: t('list.waiter'),
      mobile: 'title',
      cell: (s) => (
        <CellMain
          media={<WaiterBadge name={s.subject.name} color={s.subject.color} />}
          title={s.subject.name}
          titleText={s.subject.name}
          sub={s.eventName || undefined}
          subText={s.eventName || undefined}
        />
      ),
    },
    {
      id: 'period',
      header: t('list.period'),
      mobile: 'meta',
      className: 'admin-dt__date',
      cell: (s) => `${s.periodFrom ? formatDateTime(s.periodFrom) : t('list.fromStart')} – ${formatDateTime(s.periodTo)}`,
    },
    {
      id: 'collected',
      header: t('list.collected'),
      num: true,
      mobile: 'trailing',
      cell: (s) => (s.totals.payments ? formatCurrency(s.totals.payments.total.amount) : '—'),
    },
    {
      id: 'cashExpected',
      header: t('list.cashExpected'),
      num: true,
      priority: 2,
      cell: (s) => (s.cashExpected === null ? '—' : formatCurrency(s.cashExpected)),
    },
    {
      id: 'settledBy',
      header: t('list.settledBy'),
      priority: 3,
      cell: (s) =>
        s.settledBy?.name || s.deviceName ? (
          <span className="waiter-settlements__by">
            <CellText title={s.settledBy?.name ?? undefined}>{s.settledBy?.name ?? '—'}</CellText>
            {s.deviceName && (
              <CellText muted title={s.deviceName}>
                {s.deviceName}
              </CellText>
            )}
          </span>
        ) : (
          <CellNone />
        ),
    },
  ];

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
      <div data-testid="waiter-settlements-table">
        <AdminTable
          caption={t('list.title')}
          rows={settlements}
          rowKey="id"
          columns={columns}
          actions={(s) => [
            {
              id: 'open',
              label: t('list.open', { number: s.number ?? '–' }),
              icon: 'eye',
              onClick: () => setOpen(s),
            },
          ]}
          // Die ganze Zeile öffnet die Einzelansicht (auch per Tastatur).
          onRowClick={(s) => setOpen(s)}
        />
      </div>
    );

  return (
    <section className="app-card app-card--flat" aria-labelledby="waiter-settlements-title" data-testid="waiter-settlements">
      <div className="app-card__head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 id="waiter-settlements-title" className="waiters-settings__title">
            {t('list.title')}
          </h2>
          <p className="waiters-form__hint">
            {view === 'live' ? t('live.description') : t('list.description')} {t('list.electronicOnly')}
          </p>
        </div>
        <Segment<'settlements' | 'live'>
          aria-label={t('list.views')}
          value={view}
          onChange={setView}
          options={[
            { id: 'settlements', label: t('list.tabSettlements') },
            { id: 'live', label: t('list.tabLive') },
          ]}
        />
      </div>
      {view === 'live' ? <WaiterLiveAudit organizationId={organizationId} eventId={eventId} /> : body}
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
            <SettlementTseLine tse={settlement.tse} />
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
            {t('detail.copy')}
          </button>
        </div>
      </ModalPanel>
    </div>
  );
}
