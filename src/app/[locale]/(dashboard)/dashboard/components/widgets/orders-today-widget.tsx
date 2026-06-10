'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api-client';

interface Props {
  organizationId: string;
}

export function OrdersTodayWidget({ organizationId }: Props) {
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

  const count = useMemo(() => {
    const orders = ordersResponse || [];
    return orders.filter((o) => o.status !== 'cancelled').length;
  }, [ordersResponse]);

  return (
    <div className="stat-card">
      <div className="stat-card__label">{t('stats.ordersToday')}</div>
      <div className="stat-card__value">{isLoading ? '—' : count}</div>
      <div className="stat-card__sub">{t('stats.vsYesterday')}</div>
    </div>
  );
}
