'use client';

import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { useIntlLocale } from '@/hooks/use-locale-format';
import { phaseMoment } from '@/lib/event-phase';

/**
 * Testmodus der Kasse: ein schmaler Streifen unter dem Kopf, eine Zeile,
 * nicht schließbar — er gilt, solange die Veranstaltung im Test läuft,
 * und nimmt kaum Platz weg. Sonst kein weiteres Testmodus-Element.
 */
export function PosTestModeBanner({ realSalesFrom }: { realSalesFrom?: string | null } = {}) {
  const t = useTranslations('pos');
  const locale = useIntlLocale();
  // Zustand „Geplant“ (bezahlt, vor dem Verkaufsfenster): Testbetrieb bis
  // zum Beginn der echten Verkäufe — die Testbestellungen werden dann gelöscht.
  return (
    <Banner tone="warn" icon={<Icon name="alert" />} className="pos-testband">
      {realSalesFrom ? t('plannedMode', phaseMoment(realSalesFrom, locale)) : t('testMode')}
    </Banner>
  );
}

/** Veranstaltung beendet: keine neuen Bestellungen, offene weiter kassieren. */
export function PosEndedBanner() {
  const t = useTranslations('pos');
  return (
    <Banner tone="info" icon={<Icon name="info" />} className="pos-testband">
      {t('endedMode')}
    </Banner>
  );
}
