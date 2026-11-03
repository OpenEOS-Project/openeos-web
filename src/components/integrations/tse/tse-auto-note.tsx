'use client';

import { useTranslations } from 'next-intl';

import { Banner, Icon } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';

import type { TseAutoEnabled } from '@/types/tse';

/**
 * „Automatisch eingeschaltet beim Kauf von <Veranstaltung>“: OpenEOS hat die
 * Integration selbst eingeschaltet (Kauf einer Veranstaltung in „Alle
 * Funktionen“ bzw. Wechsel auf „Alle Funktionen“ mit bezahlter
 * Veranstaltung). Ein Umschalten von Hand entfernt den Hinweis.
 */
export function TseAutoNote({ auto }: { auto: TseAutoEnabled }) {
  const t = useTranslations('integrations.tse.autoEnabled');
  const { formatDate } = useLocaleFormat();
  const name = auto.eventName ?? '';
  return (
    <div data-testid="tse-auto-enabled" data-source={auto.source}>
      <Banner tone="info" icon={<Icon name="shield" />}>
        {auto.source === 'purchase'
          ? t('purchase', { name, date: auto.at ? formatDate(auto.at) : '' })
          : t('operatingMode', { name })}
      </Banner>
    </div>
  );
}
