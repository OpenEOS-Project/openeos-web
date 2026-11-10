'use client';

import { useTranslations } from 'next-intl';
import { Banner, Icon } from '@openeos/ui';

import { useIntlLocale } from '@/hooks/use-locale-format';
import { phaseMoment } from '@/lib/event-phase';

/**
 * Testbetrieb/Testmodus der Kasse: ein schmaler Streifen unter dem Kopf,
 * eine Zeile, nicht schließbar — er gilt, solange die Veranstaltung im Test
 * läuft, und nimmt kaum Platz weg. Auf dem Telefon die Kurzfassung, der
 * ganze Satz steht im Tooltip. Mit Cloud-TSE sind es Trainingsbuchungen —
 * das deckt „Buchungen zählen nicht“ ab, ohne eigenen Hinweis.
 */
export function PosTestModeBanner({ realSalesFrom }: { realSalesFrom?: string | null } = {}) {
  const t = useTranslations('pos');
  const locale = useIntlLocale();
  // Zustand „Geplant“ (bezahlt, vor dem Verkaufsfenster): Testbetrieb bis
  // zum Beginn der echten Verkäufe — die Testbestellungen werden dann gelöscht.
  const moment = realSalesFrom ? phaseMoment(realSalesFrom, locale) : null;
  return (
    <PosBand
      tone="warn"
      icon="alert"
      long={moment ? t('plannedMode', moment) : t('testMode')}
      short={moment ? t('plannedModeShort', moment) : t('testModeShort')}
    />
  );
}

/** Veranstaltung beendet: keine neuen Bestellungen, offene weiter kassieren. */
export function PosEndedBanner() {
  const t = useTranslations('pos');
  return <PosBand tone="info" icon="info" long={t('endedMode')} short={t('endedModeShort')} />;
}

interface PosBandProps {
  tone: 'warn' | 'info';
  icon: 'alert' | 'info';
  /** Ganzer Satz (Tablet, Desktop, Tooltip). */
  long: string;
  /** Kurzfassung für das Telefon — eine Zeile. */
  short: string;
}

function PosBand({ tone, icon, long, short }: PosBandProps) {
  return (
    <Banner tone={tone} icon={<Icon name={icon} />} className="pos-testband">
      <span className="pos-testband__long" title={long}>
        {long}
      </span>
      <span className="pos-testband__short" title={long}>
        {short}
      </span>
    </Banner>
  );
}
