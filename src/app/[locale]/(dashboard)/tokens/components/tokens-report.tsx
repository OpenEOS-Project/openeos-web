'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { downloadCsv } from '@/app/[locale]/(dashboard)/reports/components/csv-export';
import {
  ReportsFilterBar,
  type ReportsFilter,
} from '@/app/[locale]/(dashboard)/reports/components/reports-filter-bar';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useEvents } from '@/hooks/use-events';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useTokenReport } from '@/hooks/use-token-types';
import {
  TOKEN_REPORT_FIGURES,
  formatTokenCount,
  tokenReportCsvRows,
  tokenRowHasMovement,
  type TokenReportFigure,
} from '@/lib/token-admin';
import type { TokenFigures, TokenReportRow } from '@/types/token';

import { TokensTransactions } from './tokens-transactions';

/**
 * Auswertung der Wertmarken: je Markentyp verkauft, eingelöst, bei Storno
 * zurückgegeben, zurückgetauscht und im Umlauf (Stück und Euro), dazu je
 * Veranstaltung und die letzten Verkäufe/Rücktausche. Verkaufte Marken
 * sind kein Umsatz — Umsatz entsteht beim Einlösen.
 */
export function TokensReport({ organizationId }: { organizationId: string }) {
  const t = useTranslations('tokens.report');
  const locale = useLocale();
  const { formatCurrency } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const { data: events = [], isLoading: eventsLoading } = useEvents(organizationId);
  // Standard: alles — „im Umlauf“ ergibt nur über die ganze Zeit den Bestand.
  const [filter, setFilter] = useState<ReportsFilter>({ eventId: '', timeRange: 'all', startDate: '', endDate: '' });
  const query = useMemo(
    () => ({
      eventId: filter.eventId || undefined,
      startDate: filter.startDate || undefined,
      endDate: filter.endDate || undefined,
    }),
    [filter.eventId, filter.startDate, filter.endDate],
  );
  const report = useTokenReport(organizationId, query);
  const data = report.data;

  const headers = TOKEN_REPORT_FIGURES.map((key) => t(`columns.${key}`));
  const figure = (value: TokenFigures, strong = false) => (
    <span className="token-figure">
      {strong ? <b>{formatCurrency(value.amount)}</b> : formatCurrency(value.amount)}
      <small>{t('pieces', { count: formatTokenCount(value.count, locale) })}</small>
    </span>
  );

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      t('csvFilename'),
      [t('columns.type'), ...TOKEN_REPORT_FIGURES.flatMap((key) => [`${t(`columns.${key}`)} (${t('csvCount')})`, `${t(`columns.${key}`)} (€)`])],
      tokenReportCsvRows(data.types, { name: t('total'), ...data.totals }),
    );
  };

  const byEvent = (data?.byEvent ?? []).filter(tokenRowHasMovement);
  const totalsRow = data?.totals;

  const figureCells = (row: Pick<TokenReportRow, TokenReportFigure>, strong = false) =>
    TOKEN_REPORT_FIGURES.map((key) => (
      <td key={key} className="mono text-right">
        {figure(row[key], strong)}
      </td>
    ));

  let body;
  if (report.isLoading)
    body = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div className="spinner" role="status" aria-label={t('loading')} />
      </div>
    );
  else if (report.error || !data)
    body = (
      <p role="alert" className="app-card__sub" style={{ padding: '0 20px 20px', color: 'var(--danger)' }}>
        {apiErrorMessage(report.error, t('loadFailed'))}
      </p>
    );
  else if (data.types.length === 0)
    body = (
      <div className="empty-state">
        <h3 className="empty-state__title">{t('empty')}</h3>
      </div>
    );
  else
    body = (
      <>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" data-testid="tokens-report-table">
            <thead>
              <tr>
                <th>{t('columns.type')}</th>
                {headers.map((header) => (
                  <th key={header} className="text-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.types.map((row) => (
                <tr key={row.tokenTypeId}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{row.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--oe-mute)' }}>
                      {formatCurrency(row.value)} · {row.kind === 'single_purpose' ? t('kindSingle') : t('kindMulti')}
                    </div>
                  </td>
                  {figureCells(row)}
                </tr>
              ))}
              {totalsRow && (
                <tr data-testid="tokens-report-total">
                  <td>
                    <b>{t('total')}</b>
                  </td>
                  {figureCells(totalsRow, true)}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!filter.eventId && byEvent.length > 0 && (
          <>
            <h3 className="token-report__sub">{t('byEventTitle')}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" data-testid="tokens-report-by-event">
                <thead>
                  <tr>
                    <th>{t('columns.event')}</th>
                    <th>{t('columns.type')}</th>
                    {headers.map((header) => (
                      <th key={header} className="text-right">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEvent.map((row) => (
                    <tr key={`${row.tokenTypeId}|${row.eventId ?? ''}`}>
                      <td style={{ fontSize: 13 }}>{row.eventName ?? t('noEvent')}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{row.name}</td>
                      {figureCells(row)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="token-report__hints">
          <p>{t('hints.notRevenue')}</p>
          <p>{t('hints.returned')}</p>
          <p>{filter.startDate || filter.endDate ? t('hints.outstandingPeriod') : t('hints.outstanding')}</p>
        </div>
      </>
    );

  return (
    <>
      <ReportsFilterBar
        filter={filter}
        events={events}
        eventsLoading={eventsLoading}
        onChange={setFilter}
        actions={
          <button
            type="button"
            className="btn btn--ghost"
            style={{ fontSize: 13 }}
            onClick={exportCsv}
            disabled={!data || data.types.length === 0}
          >
            {t('csv')}
          </button>
        }
      />

      <div className="app-card app-card--flat" data-testid="tokens-report">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('title')}</h2>
            <p className="app-card__sub">{t('subtitle')}</p>
          </div>
        </div>
        {body}
      </div>

      <TokensTransactions organizationId={organizationId} query={query} />
    </>
  );
}
