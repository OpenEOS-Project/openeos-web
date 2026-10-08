'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import type { CategoryReport, NetSalesSummary } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { netReconciliation } from '@/utils/report-net';
import { downloadCsv } from './csv-export';
import { ReportsNetFooter } from './reports-net-footer';

interface ReportsCategoriesTableProps {
  data: CategoryReport[] | undefined;
  /** Abgleich mit dem Umsatz netto (Erstattungen ohne Position, Trinkgeld). */
  net?: NetSalesSummary;
  isLoading: boolean;
}

export function ReportsCategoriesTable({ data, net, isLoading }: ReportsCategoriesTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();
  const netLines = useMemo(
    () => (net && data?.length ? netReconciliation(data.map((c) => c.revenue), net) : []),
    [net, data],
  );

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [t('categories.columns.category'), t('categories.columns.quantity'), t('categories.columns.revenue')];
    const rows: (string | number)[][] = data.map((c) => [c.name, c.quantity, c.revenue]);
    for (const line of netLines) {
      rows.push([line.key === 'items' ? t('net.categoryItems') : t(`net.${line.key}`), '', line.amount]);
    }
    downloadCsv(t('export.filenames.categories'), headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('categories.title')}</h2>
          <p className="app-card__sub">{t('categories.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 13 }}
          onClick={handleExport}
          disabled={!data?.length}
        >
          {t('export.csv')}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{t('loading')}</div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('categories.empty')}</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('categories.columns.category')}</th>
                <th className="text-right">{t('categories.columns.quantity')}</th>
                <th className="text-right">{t('categories.columns.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.categoryId}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{c.name}</div>
                  </td>
                  <td className="mono text-right">{c.quantity}</td>
                  <td className="mono text-right">{formatCurrency(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
            {netLines.length > 0 && (
              <ReportsNetFooter lines={netLines} labelSpan={2} itemsLabel={t('net.categoryItems')} />
            )}
          </table>
          <p className="report-net__note">{t('net.note')}</p>
        </div>
      )}
    </div>
  );
}
