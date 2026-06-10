'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';

interface Props {
  organizationId: string;
}

export function RevenueTodayWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ['orders', organizationId, 'today', today],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, { dateFrom: today, dateTo: today });
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
      <div className="stat-card__sub">{t('stats.vsYesterday')}</div>
    </div>
  );
}
