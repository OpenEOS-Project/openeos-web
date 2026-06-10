'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import type { HourlyReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from './csv-export';

interface ReportsHourlyChartProps {
  data: HourlyReport[] | undefined;
  isLoading: boolean;
}

interface TooltipPayload {
  value: number;
  payload: HourlyReport;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const t = useTranslations('reports');
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0].payload;
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--ink)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{`${label}:00 Uhr`}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{t('hourly.tooltipRevenue')}: <strong>{formatCurrency(entry.revenue)}</strong></span>
        <span>{t('hourly.tooltipOrders')}: <strong>{entry.orders}</strong></span>
      </div>
    </div>
  );
}

export function ReportsHourlyChart({ data, isLoading }: ReportsHourlyChartProps) {
  const t = useTranslations('reports');

  // Fill all 24 hours, merging with real data
  const chartData = useMemo(() => {
    const map = new Map<number, HourlyReport>();
    if (data) {
      for (const entry of data) {
        map.set(entry.hour, entry);
      }
    }
    return Array.from({ length: 24 }, (_, h) => map.get(h) ?? { hour: h, orders: 0, revenue: 0 });
  }, [data]);

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('hourly.columns.hour'),
      t('hourly.columns.orders'),
      t('hourly.columns.revenue'),
    ];
    const rows = chartData.map((r) => [`${r.hour}:00`, r.orders, r.revenue]);
    downloadCsv('stundenverlauf.csv', headers, rows);
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('hourly.title')}</h2>
          <p className="app-card__sub">{t('hourly.subtitle')}</p>
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
      ) : (
        <div style={{ padding: '8px 20px 20px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,0,0,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                tickFormatter={(h: number) => `${h}`}
                tick={{ fontSize: 11, fill: 'var(--ink)', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                }
                tick={{ fontSize: 11, fill: 'var(--ink)', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="revenue" fill="#12B76A" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
