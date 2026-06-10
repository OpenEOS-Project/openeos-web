'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import type { ProductReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from './csv-export';

interface ReportsProductsTableProps {
  data: ProductReport[] | undefined;
  isLoading: boolean;
}

export function ReportsProductsTable({ data, isLoading }: ReportsProductsTableProps) {
  const t = useTranslations('reports');

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const handleExport = () => {
    if (!sorted.length) return;
    const headers = [
      t('products.columns.product'),
      t('products.columns.category'),
      t('products.columns.quantity'),
      t('products.columns.revenue'),
      t('products.columns.avgPrice'),
    ];
    const rows = sorted.map((p) => [
      p.productName,
      p.categoryName,
      p.quantitySold,
      p.revenue,
      p.averagePrice,
    ]);
    downloadCsv('top-produkte.csv', headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('products.title')}</h2>
          <p className="app-card__sub">{t('products.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 13 }}
          onClick={handleExport}
          disabled={!sorted.length}
        >
          {t('export.csv')}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{t('loading')}</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('products.empty')}</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('products.columns.product')}</th>
                <th>{t('products.columns.category')}</th>
                <th className="text-right">{t('products.columns.quantity')}</th>
                <th className="text-right">{t('products.columns.revenue')}</th>
                <th className="text-right">{t('products.columns.avgPrice')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.productId}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{p.productName}</div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7 }}>{p.categoryName}</td>
                  <td className="mono text-right">{p.quantitySold}</td>
                  <td className="mono text-right">{formatCurrency(p.revenue)}</td>
                  <td className="mono text-right">{formatCurrency(p.averagePrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
