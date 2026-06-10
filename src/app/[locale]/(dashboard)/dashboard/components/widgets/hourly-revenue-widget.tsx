'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useHourlyReport } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';

interface Props {
  organizationId: string;
}

export function HourlyRevenueWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const today = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    return { startDate: date, endDate: date };
  }, []);

  const { data, isLoading } = useHourlyReport(organizationId, today);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((row) => ({
      hour: `${String(row.hour).padStart(2, '0')}:00`,
      revenue: row.revenue,
      orders: row.orders,
    }));
  }, [data]);

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('widgets.hourlyRevenue.label')}</h2>
          <p className="app-card__sub">{t('widgets.hourlyRevenue.subtitle')}</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : chartData.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <p className="empty-state__sub">{t('widgets.empty')}</p>
        </div>
      ) : (
        <div style={{ height: 220, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, var(--ink) 8%, transparent)" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 11, fill: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), t('widgets.hourlyRevenue.revenueLabel')]}
                contentStyle={{
                  background: 'var(--paper)',
                  border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }}
              />
              <Bar dataKey="revenue" fill="var(--green-ink)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
