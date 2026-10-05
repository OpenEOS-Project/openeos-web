'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { PaymentReport } from '@/types/report';
import { formatCurrency, formatPercent } from '@/utils/format';
import { downloadCsv } from './csv-export';
import { getMethodLabel } from './report-labels';

interface ReportsPaymentsTableProps {
  data: PaymentReport[] | undefined;
  isLoading: boolean;
}

export function ReportsPaymentsTable({ data, isLoading }: ReportsPaymentsTableProps) {
  const t = useTranslations('reports');
  const locale = useLocale();

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('payments.columns.method'),
      t('payments.columns.count'),
      t('payments.columns.total'),
      t('payments.columns.percentage'),
    ];
    const rows = data.map((p) => [
      getMethodLabel(p.method, t),
      p.count,
      p.total,
      formatPercent(p.percentage, locale),
    ]);
    downloadCsv(t('export.filenames.payments'), headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('payments.title')}</h2>
          <p className="app-card__sub">{t('payments.subtitle')}</p>
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
          <h3 className="empty-state__title">{t('payments.empty')}</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.columns.method')}</th>
                <th className="text-right">{t('payments.columns.count')}</th>
                <th className="text-right">{t('payments.columns.total')}</th>
                <th className="text-right">{t('payments.columns.percentage')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.method}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                      {getMethodLabel(p.method, t)}
                    </div>
                  </td>
                  <td className="mono text-right">{p.count}</td>
                  <td className="mono text-right">{formatCurrency(p.total, locale)}</td>
                  <td className="text-right">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div
                        style={{
                          width: 60,
                          height: 6,
                          borderRadius: 3,
                          background: 'color-mix(in oklab, var(--ink) 8%, transparent)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(p.percentage, 100)}%`,
                            height: '100%',
                            background: '#12B76A',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: 13, minWidth: 40, textAlign: 'right' }}>
                        {formatPercent(p.percentage, locale)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
