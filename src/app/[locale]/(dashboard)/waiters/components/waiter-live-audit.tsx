'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type DataColumn } from '@openeos/ui';

import { downloadCsv } from '@/app/[locale]/(dashboard)/reports/components/csv-export';
import { ListLoading } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellText } from '@/components/shared/admin-table';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useLiveCashAudit } from '@/hooks/use-waiters';
import { canPayOutCardTips, liveAuditCsvRows, liveAuditDrawers } from '@/lib/waiters';
import type { LiveCashAuditRow } from '@/types/waiter';

import { TipPayoutModal } from './tip-payout-modal';
import { WaiterBadge } from './waiter-badge';

import '@/styles/settlements.css';

/** Zeile der Tabelle: eine Bedienung oder die Summe am Ende. */
type AuditLine = LiveCashAuditRow | 'total';

interface WaiterLiveAuditProps {
  organizationId: string;
  /** Filter der Seite; ohne: die laufende Veranstaltung. */
  eventId: string | null;
}

/**
 * Live-Kassensturz (Steuerberater 2026-11-10, Frage 7): für eine
 * Kassen-Nachschau das Soll jeder Bedienung seit ihrer letzten Abrechnung —
 * bar, in welcher Schublade, Karte, Trinkgeld, offene Tische und bei
 * Arbeitnehmern das offene Kartentrinkgeld (auszahlbar).
 */
export function WaiterLiveAudit({ organizationId, eventId }: WaiterLiveAuditProps) {
  const t = useTranslations('waiterSettlement.live');
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const audit = useLiveCashAudit(organizationId, eventId);
  const [payout, setPayout] = useState<LiveCashAuditRow | null>(null);
  const data = audit.data;
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatCurrency(value));

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      t('csvFilename'),
      [t('col.waiter'), t('col.cashExpected'), t('col.drawers'), t('col.card'), t('col.tips'), t('col.openTables'), t('col.openCardTips'), t('col.lastSettlement')],
      liveAuditCsvRows(data, { noDevice: t('noDevice') }),
    );
  };

  const drawers = (row: LiveCashAuditRow) => {
    const list = liveAuditDrawers(row);
    if (list.length === 0) return '—';
    return (
      <span className="live-audit__drawers">
        {list.map((d) => (
          <span key={d.deviceId ?? 'none'}>
            {d.deviceName ?? t('noDevice')}: {formatCurrency(d.amount)}
          </span>
        ))}
      </span>
    );
  };

  const cardTips = (row: LiveCashAuditRow) => {
    if (row.openCardTips === null) return <span title={t('volunteerTitle')}>—</span>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        {formatCurrency(row.openCardTips)}
        {canPayOutCardTips(row.openCardTips) && row.subject.waiterId && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setPayout(row)}
            data-testid="live-audit-payout"
          >
            {t('payOut')}
          </button>
        )}
      </span>
    );
  };

  /* Die Summenzeile steht als letzte Zeile in der Tabelle, damit die
     Beträge unter ihren Spalten stehen. */
  const columns: DataColumn<AuditLine>[] = [
    {
      id: 'waiter',
      header: t('col.waiter'),
      mobile: 'title',
      cell: (line) =>
        line === 'total' ? (
          t('total')
        ) : (
          <CellMain
            media={<WaiterBadge name={line.subject.name} color={line.subject.color} />}
            title={line.subject.name}
            titleText={line.subject.name}
            sub={line.periodFrom ? t('since', { from: formatDateTime(line.periodFrom) }) : undefined}
          />
        ),
    },
    {
      id: 'cashExpected',
      header: t('col.cashExpected'),
      num: true,
      mobile: 'trailing',
      cell: (line) =>
        line === 'total' ? formatCurrency(data?.total.cashExpected ?? 0) : <b>{money(line.cashExpected)}</b>,
    },
    {
      id: 'drawers',
      header: t('col.drawers'),
      mobile: 'meta',
      cell: (line) => (line === 'total' ? null : drawers(line)),
    },
    { id: 'card', header: t('col.card'), num: true, cell: (line) => (line === 'total' ? null : money(line.payments?.card.amount)) },
    {
      id: 'tips',
      header: t('col.tips'),
      num: true,
      cell: (line) => (line === 'total' ? formatCurrency(data?.total.tips ?? 0) : money(line.tips)),
    },
    { id: 'openTables', header: t('col.openTables'), num: true, cell: (line) => (line === 'total' ? null : line.openTables) },
    { id: 'openCardTips', header: t('col.openCardTips'), num: true, cell: (line) => (line === 'total' ? null : cardTips(line)) },
    {
      id: 'lastSettlement',
      header: t('col.lastSettlement'),
      priority: 2,
      cell: (line) => {
        if (line === 'total') return null;
        const text = line.lastSettlement
          ? t('lastSettlement', { number: line.lastSettlement.number ?? '–', at: formatDateTime(line.lastSettlement.createdAt) })
          : t('noSettlement');
        return (
          <CellText muted title={text}>
            {text}
          </CellText>
        );
      },
    },
  ];

  let body;
  if (audit.isLoading) body = <ListLoading />;
  else if (audit.error || !data)
    body = (
      <p className="waiters-form__error" style={{ padding: '0 20px 20px' }}>
        {apiErrorMessage(audit.error, t('loadFailed'))}
      </p>
    );
  else if (data.rows.length === 0)
    body = (
      <p className="waiters-form__hint" style={{ padding: '0 20px 20px' }}>
        {data.eventId ? t('empty') : t('noEvent')}
      </p>
    );
  else
    body = (
      <>
        {/* Ab Tablet eine Tabelle; auf dem Telefon Karten mit allen Beträgen
            (für die Kassen-Nachschau zählt jeder Wert, die zweizeilige
            Telefon-Ansicht der DataTable würde die meisten ausblenden). */}
        <div className="live-audit__table" data-testid="live-audit-table">
          <AdminTable<AuditLine>
            caption={t('title')}
            rows={[...data.rows, 'total']}
            rowKey={(line) => (line === 'total' ? 'total' : line.subject.id)}
            columns={columns}
            rowClassName={(line) => (line === 'total' ? 'live-audit__total' : undefined)}
          />
        </div>
        <ul className="live-audit__cards" data-testid="live-audit-cards">
          {data.rows.map((row) => (
            <li key={row.subject.id} className="live-audit__card">
              <div className="waiters-name">
                <WaiterBadge name={row.subject.name} color={row.subject.color} />
                <span>
                  <b>{row.subject.name}</b>
                  {row.periodFrom && <small>{t('since', { from: formatDateTime(row.periodFrom) })}</small>}
                </span>
              </div>
              <dl>
                <dt>{t('col.cashExpected')}</dt>
                <dd>
                  <b>{money(row.cashExpected)}</b>
                </dd>
                <dt>{t('col.drawers')}</dt>
                <dd>{drawers(row)}</dd>
                <dt>{t('col.card')}</dt>
                <dd>{money(row.payments?.card.amount)}</dd>
                <dt>{t('col.tips')}</dt>
                <dd>{money(row.tips)}</dd>
                <dt>{t('col.openTables')}</dt>
                <dd>{row.openTables}</dd>
                {row.openCardTips !== null && (
                  <>
                    <dt>{t('col.openCardTips')}</dt>
                    <dd>{cardTips(row)}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
          <li className="live-audit__card">
            <dl>
              <dt>
                <b>{t('total')}</b>
              </dt>
              <dd>
                <b>{formatCurrency(data.total.cashExpected)}</b>
              </dd>
            </dl>
          </li>
        </ul>
      </>
    );

  return (
    <div className="live-audit" data-testid="live-audit">
      <p className="waiters-form__hint" style={{ padding: '0 20px' }}>
        {t('hint')}
      </p>
      <div className="live-audit__bar">
        <span data-testid="live-audit-stamp">
          {data
            ? t('stamp', { at: formatDateTime(data.generatedAt), event: data.eventName ?? t('noEventName') })
            : ''}
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => void audit.refetch()} disabled={audit.isFetching}>
          <Icon name="refresh" size={16} />
          {audit.isFetching ? t('refreshing') : t('refresh')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
          <Icon name="download" size={16} />
          {t('csv')}
        </button>
      </div>
      {body}
      <p className="waiters-form__hint" style={{ padding: '0 20px 16px' }}>
        {t('tipsHint')}
      </p>
      {payout?.subject.waiterId && (
        <TipPayoutModal
          organizationId={organizationId}
          waiterId={payout.subject.waiterId}
          waiterName={payout.subject.name}
          eventId={data?.eventId ?? null}
          onClose={() => setPayout(null)}
          onPaid={() => void audit.refetch()}
        />
      )}
    </div>
  );
}
