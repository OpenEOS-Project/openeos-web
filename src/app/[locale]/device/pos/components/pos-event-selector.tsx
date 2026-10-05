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
        /* Feste Farben wie der Testmodus-Hinweis in der Kopfzeile: die
           Kasse ist immer hell, die Theme-Klassen ergaben hier 2,7:1. */
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: '#fff3d0', color: '#754b00', border: '1px solid #e6ca91' }}
        >
          {t('testBadge')}
        </span>
      )}
    </div>
  );
}
