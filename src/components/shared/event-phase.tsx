'use client';

import { useTranslations } from 'next-intl';

import { useIntlLocale } from '@/hooks/use-locale-format';
import { EVENT_PHASE_BADGE, phaseMoment, useEventPhase } from '@/lib/event-phase';
import type { Event } from '@/types/event';

type PhaseEvent = Pick<
  Event,
  'status' | 'phase' | 'realSalesFrom' | 'realSalesUntil' | 'presaleEnabled' | 'phaseDetails'
>;

/** Badge „Geplant“, „Aktiv“, „Beendet“, „Testmodus“ oder „Inaktiv“. */
export function EventPhaseBadge({ event }: { event: PhaseEvent }) {
  const t = useTranslations('events.phase');
  const phase = useEventPhase(event) ?? event.status;
  return <span className={EVENT_PHASE_BADGE[phase]}>{t(`label.${phase}`)}</span>;
}

/**
 * Ein Satz zur Phase: wann echte Verkaeufe beginnen (Testbetrieb bis
 * dahin), bis wann verkauft wird oder seit wann die Veranstaltung beendet
 * ist. `null`, wenn es nichts zu sagen gibt (Testmodus, inaktiv, ohne
 * Verkaufsfenster).
 */
export function useEventPhaseHint(event: PhaseEvent | null | undefined): string | null {
  const t = useTranslations('events.phase');
  const locale = useIntlLocale();
  const phase = useEventPhase(event);
  if (!event || !phase) return null;
  if (phase === 'planned' && event.realSalesFrom) {
    const values = phaseMoment(event.realSalesFrom, locale);
    return event.presaleEnabled ? t('hint.plannedPresale', values) : t('hint.planned', values);
  }
  if (phase === 'active' && event.realSalesUntil && event.phaseDetails?.datePhases) {
    return t('hint.active', phaseMoment(event.realSalesUntil, locale));
  }
  if (phase === 'ended' && event.realSalesUntil) {
    return t('hint.ended', phaseMoment(event.realSalesUntil, locale));
  }
  return null;
}

export function EventPhaseHint({ event, className }: { event: PhaseEvent; className?: string }) {
  const hint = useEventPhaseHint(event);
  if (!hint) return null;
  return (
    <div className={className} style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>
      {hint}
    </div>
  );
}
