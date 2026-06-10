'use client';

import { useTranslations } from 'next-intl';
import { useEvents } from '@/hooks/use-events';

interface Props {
  organizationId: string;
}

export function ActiveEventsWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard');
  const { data: events, isLoading } = useEvents(organizationId);

  const count = events?.filter((e) => e.status === 'active' || e.status === 'test').length ?? 0;

  return (
    <div className="stat-card">
      <div className="stat-card__label">{t('stats.activeEvents')}</div>
      <div className="stat-card__value">{isLoading ? '—' : count}</div>
      <div className="stat-card__sub">{t('stats.eventsRunning')}</div>
    </div>
  );
}
