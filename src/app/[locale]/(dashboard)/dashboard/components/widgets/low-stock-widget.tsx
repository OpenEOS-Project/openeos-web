'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useInventoryReport } from '@/hooks/use-reports';

interface Props {
  organizationId: string;
}

export function LowStockWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const today = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    return { startDate: date, endDate: date };
  }, []);

  const { data, isLoading } = useInventoryReport(organizationId, today);

  const top5 = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.currentStock - b.currentStock).slice(0, 5);
  }, [data]);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.lowStock.label')}</h2>
          <p className="app-card__sub">{t('widgets.lowStock.subtitle')}</p>
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
                <th>{t('widgets.lowStock.product')}</th>
                <th style={{ textAlign: 'right' }}>{t('widgets.lowStock.stock')}</th>
                <th>{t('widgets.lowStock.status')}</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((row) => (
                <tr key={row.productId}>
                  <td style={{ fontWeight: 500 }}>{row.productName}</td>
                  <td
                    className="mono"
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: row.lowStock ? 'var(--red-ink, var(--danger))' : undefined,
                    }}
                  >
                    {row.currentStock}
                  </td>
                  <td>
                    {row.lowStock ? (
                      <span className="badge badge--error">{t('widgets.lowStock.low')}</span>
                    ) : (
                      <span className="badge badge--success">{t('widgets.lowStock.ok')}</span>
                    )}
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
