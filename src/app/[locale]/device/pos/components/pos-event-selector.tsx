'use client';

import { useTranslations } from 'next-intl';
import { Calendar } from '@untitledui/icons';
import type { Event } from '@/types/event';

interface PosActiveEventBadgeProps {
  event: Event | null;
}

export function PosActiveEventBadge({ event }: PosActiveEventBadgeProps) {
  const t = useTranslations('pos');

  if (!event) {
    return (
      <div className="flex items-center gap-2 text-sm text-tertiary">
        <Calendar className="h-4 w-4" />
        <span>{t('noActiveEvent')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-primary">
      <Calendar className="h-4 w-4 text-tertiary" />
      <span>{event.name}</span>
      {event.status === 'test' && (
        <span className="rounded-full bg-warning-secondary px-2 py-0.5 text-xs font-medium text-warning-primary dark:text-white">
          {t('testBadge')}
        </span>
      )}
    </div>
  );
}
