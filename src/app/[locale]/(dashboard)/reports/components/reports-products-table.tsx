'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import type { NetSalesSummary, ProductReport } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { netReconciliation } from '@/utils/report-net';
import { rankByMode } from '@/lib/operating-mode';
import { downloadCsv } from './csv-export';
import { ReportsNetFooter } from './reports-net-footer';

interface ReportsProductsTableProps {
  data: ProductReport[] | undefined;
  /** Abgleich mit dem Umsatz netto (Erstattungen ohne Position, Trinkgeld). */
  net?: NetSalesSummary;
  isLoading: boolean;
  /** „Nur Bestellen“: nach Menge, Betrag als Bestellwert (nicht kassiert), ohne Abgleich. */
  orderOnly?: boolean;
}

export function ReportsProductsTable({ data, net, isLoading, orderOnly = false }: ReportsProductsTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();

  const sorted = useMemo(() => {
    if (!data) return [];
    return rankByMode(data, orderOnly, (p) => p.quantitySold, (p) => p.revenue);
  }, [data, orderOnly]);
  // Abgleich (Erstattungen, Trinkgeld, Umsatz netto) gibt es nur mit Kasse.
  const netLines = useMemo(
    () => (!orderOnly && net && sorted.length ? netReconciliation(sorted.map((p) => p.revenue), net) : []),
    [net, sorted, orderOnly],
  );
  const amountLabel = orderOnly ? t('orderOnly.orderValue') : t('products.columns.revenue');

  const handleExport = () => {
    if (!sorted.length) return;
    const headers = [
      t('products.columns.product'),
      t('products.columns.category'),
      t('products.columns.quantity'),
      amountLabel,
      t('products.columns.avgPrice'),
    ];
    const rows = sorted.map((p) => [
      p.productName,
      p.categoryName,
      p.quantitySold,
      p.revenue,
      p.averagePrice,
    ]);
    // Abgleichzeilen wie in der Tabelle (Summe, Erstattungen ohne Position, Trinkgeld, Umsatz netto).
    for (const line of netLines) {
      rows.push([line.key === 'items' ? t('net.items') : t(`net.${line.key}`), '', '', line.amount, '']);
    }
    downloadCsv(t('export.filenames.products'), headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('products.title')}</h2>
          <p className="app-card__sub">{orderOnly ? t('orderOnly.productsSubtitle') : t('products.subtitle')}</p>
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
                <th className="text-right">{amountLabel}</th>
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
            {netLines.length > 0 && (
              <ReportsNetFooter lines={netLines} labelSpan={3} trailing={1} itemsLabel={t('net.items')} />
            )}
          </table>
          {!orderOnly && <p className="report-net__note">{t('net.note')}</p>}
        </div>
      )}
    </div>
  );
}
