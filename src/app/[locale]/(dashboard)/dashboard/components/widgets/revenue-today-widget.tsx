'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { useDashboardRange } from '../dashboard-range';

interface Props {
  organizationId: string;
}

export function RevenueTodayWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const range = useDashboardRange();


  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ['orders', organizationId, 'range', range.query.startDate, range.query.endDate],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, { dateFrom: range.query.startDate, dateTo: range.query.endDate });
      return response.data;
    },
    enabled: !!organizationId,
  });

  const revenue = useMemo(() => {
    const orders = ordersResponse || [];
    return orders
      .filter((o) => o.status !== 'cancelled')
      .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partly_paid')
      .reduce((sum, o) => sum + o.paidAmount, 0);
  }, [ordersResponse]);

  return (
    <div className="stat-card stat-card--accent">
      <div className="stat-card__label">{t('stats.revenue')}</div>
      <div className="stat-card__value">{isLoading ? '—' : formatCurrency(revenue)}</div>
      {/* Zuvor stand hier "vs. gestern" — ohne dass je ein Vergleichswert
          berechnet wurde. Der Zeitraum ist die Angabe, die hier wirklich
          etwas aussagt, und er folgt der Auswahl oben. */}
      <div className="stat-card__sub">{t(`range.period.${range.key}`)}</div>
    </div>
  );
}
