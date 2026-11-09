'use client';

import { useEffect, useState } from 'react';

import type { Event, EventPhase } from '@/types/event';

/**
 * Phase einer Veranstaltung fuer die Anzeige (Geplant – Aktiv – Beendet).
 *
 * Die Phase leitet der Server ab (Status, Abrechnung, Zeitraum, Uhrzeit).
 * Hier wird sie nur zwischen zwei Abfragen fortgeschrieben: liegt
 * `realSalesFrom` bzw. `realSalesUntil` inzwischen in der Vergangenheit,
 * gilt die naechste Phase — die Kasse muss dafuer nicht neu laden. Ohne
 * die Felder (aeltere API) bleibt es beim Status.
 */
export function currentEventPhase(
  event: Pick<Event, 'status' | 'phase' | 'realSalesFrom' | 'realSalesUntil'> | null | undefined,
  now: number = Date.now(),
): EventPhase | null {
  if (!event) return null;
  const phase: EventPhase = event.phase ?? event.status;
  if (phase === 'inactive' || phase === 'test') return phase;
  if (!event.realSalesFrom || !event.realSalesUntil) return phase;
  if (now < Date.parse(event.realSalesFrom)) return 'planned';
  if (now >= Date.parse(event.realSalesUntil)) return 'ended';
  return 'active';
}

/** Naechster Zeitpunkt, an dem sich die Phase von selbst aendert (ms). */
function nextBoundary(
  event: Pick<Event, 'realSalesFrom' | 'realSalesUntil'> | null | undefined,
  now: number,
): number | null {
  const times = [event?.realSalesFrom, event?.realSalesUntil]
    .filter((value): value is string => !!value)
    .map((value) => Date.parse(value))
    .filter((time) => Number.isFinite(time) && time > now);
  return times.length ? Math.min(...times) : null;
}

/** Wie `currentEventPhase`, schaltet an den Grenzen des Fensters um. */
export function useEventPhase(
  event: Pick<Event, 'status' | 'phase' | 'realSalesFrom' | 'realSalesUntil'> | null | undefined,
): EventPhase | null {
  const [now, setNow] = useState(() => Date.now());
  const from = event?.realSalesFrom;
  const until = event?.realSalesUntil;

  useEffect(() => {
    const boundary = nextBoundary({ realSalesFrom: from, realSalesUntil: until }, Date.now());
    if (boundary === null) return;
    // setTimeout traegt hoechstens ~24,8 Tage; danach neu planen.
    const delay = Math.min(boundary - Date.now() + 500, 2 ** 31 - 1);
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [from, until, now]);

  return currentEventPhase(event, now);
}

export const EVENT_PHASE_BADGE: Record<EventPhase, string> = {
  active: 'badge badge--success',
  planned: 'badge badge--info',
  test: 'badge badge--warning',
  ended: 'badge badge--neutral',
  inactive: 'badge badge--neutral',
};

/** „15.11.“ und „18:00“ in der Sprache der Oberflaeche. */
export function phaseMoment(iso: string, locale: string): { date: string; time: string } {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
    time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}
