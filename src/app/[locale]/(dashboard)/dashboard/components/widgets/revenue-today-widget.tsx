'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useOrderOnly } from '@/hooks/use-order-only';
import { dashboardAmount } from '@/lib/operating-mode';
import { useDashboardRange } from '../dashboard-range';

interface Props {
  organizationId: string;
}

export function RevenueTodayWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const { formatCurrency } = useLocaleFormat();
  const range = useDashboardRange();
  /* „Nur Bestellen“: OpenEOS kassiert nicht — statt Umsatz der Bestellwert
     (Summe der Bestellungen, nicht kassiert). */
  const orderOnly = useOrderOnly();

  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ['orders', organizationId, 'range', range.query.startDate, range.query.endDate],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, { dateFrom: range.query.startDate, dateTo: range.query.endDate });
      return response.data;
    },
    enabled: !!organizationId,
  });

  const revenue = useMemo(() => dashboardAmount(ordersResponse || [], orderOnly), [ordersResponse, orderOnly]);

  return (
    <div className="stat-card stat-card--accent">
      <div className="stat-card__label">{orderOnly ? t('orderOnly.orderValue') : t('stats.revenue')}</div>
      <div className="stat-card__value">{isLoading ? '—' : formatCurrency(revenue)}</div>
      {/* Zuvor stand hier "vs. gestern" — ohne dass je ein Vergleichswert
          berechnet wurde. Der Zeitraum ist die Angabe, die hier wirklich
          etwas aussagt, und er folgt der Auswahl oben. */}
      <div className="stat-card__sub">{t(`range.period.${range.key}`)}</div>
    </div>
  );
}
