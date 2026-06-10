'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useProductsReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';

interface Props {
  organizationId: string;
}

export function TopProductsWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const today = useMemo(() => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    return { startDate: date, endDate: date };
  }, []);

  const { data, isLoading } = useProductsReport(organizationId, today);

  const top5 = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [data]);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.topProducts.label')}</h2>
          <p className="app-card__sub">{t('widgets.topProducts.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : top5.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('widgets.topProducts.product')}</th>
                <th>{t('widgets.topProducts.category')}</th>
                <th style={{ textAlign: 'right' }}>{t('widgets.topProducts.qty')}</th>
                <th style={{ textAlign: 'right' }}>{t('widgets.topProducts.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((row, i) => (
                <tr key={row.productId}>
                  <td className="mono" style={{ color: 'color-mix(in oklab, var(--ink) 40%, transparent)', width: 32 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{row.productName}</td>
                  <td style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontSize: 13 }}>{row.categoryName}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{row.quantitySold}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
