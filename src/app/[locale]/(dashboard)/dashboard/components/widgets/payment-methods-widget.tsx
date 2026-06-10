'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePaymentsReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';

interface Props {
  organizationId: string;
}

export function PaymentMethodsWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const today = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    return { startDate: date, endDate: date };
  }, []);

  const { data, isLoading } = usePaymentsReport(organizationId, today);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.paymentMethods.label')}</h2>
          <p className="app-card__sub">{t('widgets.paymentMethods.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {data.map((row, i) => (
            <div
              key={row.method}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderTop: i > 0 ? '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Percentage bar */}
                <div style={{ width: 48, height: 6, borderRadius: 3, background: 'color-mix(in oklab, var(--ink) 8%, transparent)', overflow: 'hidden' }}>
                  <div style={{ width: `${row.percentage}%`, height: '100%', background: 'var(--green-ink)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{row.method}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{row.count}×</span>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--f-mono)', minWidth: 80, textAlign: 'right' }}>{formatCurrency(row.total)}</span>
                <span style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', minWidth: 36, textAlign: 'right' }}>{row.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
