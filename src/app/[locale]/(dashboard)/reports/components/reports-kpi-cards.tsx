'use client';

import { useTranslations } from 'next-intl';

import type { SalesReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';

interface ReportsKpiCardsProps {
  data: SalesReport | undefined;
  isLoading: boolean;
}

export function ReportsKpiCards({ data, isLoading }: ReportsKpiCardsProps) {
  const t = useTranslations('reports');

  const val = (v: number | undefined) => (isLoading || v === undefined ? '—' : formatCurrency(v));
  const numVal = (v: number | undefined) => (isLoading || v === undefined ? '—' : String(v));

  return (
    <div className="stat-cards">
      <div className="stat-card stat-card--accent">
        <div className="stat-card__label">{t('kpi.revenue')}</div>
        <div className="stat-card__value">{val(data?.totalRevenue)}</div>
        <div className="stat-card__sub">{t('kpi.revenueSub')}</div>
      </div>

      <div className="stat-card">
        <div className="stat-card__label">{t('kpi.orders')}</div>
        <div className="stat-card__value">{numVal(data?.totalOrders)}</div>
        <div className="stat-card__sub">{t('kpi.itemsSold', { count: data?.totalItemsSold ?? 0 })}</div>
      </div>

      <div className="stat-card">
        <div className="stat-card__label">{t('kpi.avgOrder')}</div>
        <div className="stat-card__value">{val(data?.averageOrderValue)}</div>
        <div className="stat-card__sub">{t('kpi.avgOrderSub')}</div>
      </div>

      <div className="stat-card">
        <div className="stat-card__label">{t('kpi.pfand')}</div>
        <div className="stat-card__value">{val(data?.pfandBalance)}</div>
        <div className="stat-card__sub">
          {isLoading || !data
            ? '—'
            : t('kpi.pfandDetail', {
                collected: formatCurrency(data.pfandCollected),
                returned: formatCurrency(data.pfandReturned),
              })}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-card__label">{t('kpi.cancellationRate')}</div>
        <div className="stat-card__value">
          {isLoading || data?.cancellationRate === undefined ? '—' : `${data.cancellationRate.toFixed(1)}%`}
        </div>
        <div className="stat-card__sub">
          {isLoading || !data ? '—' : t('kpi.cancellationRateSub', { count: data.cancelledOrders })}
        </div>
      </div>
    </div>
  );
}
