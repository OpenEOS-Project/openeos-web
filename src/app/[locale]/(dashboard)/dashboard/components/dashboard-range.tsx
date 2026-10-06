'use client';

import { createContext, useContext, useMemo } from 'react';
import { addDays, todayKey, toDayKey } from '@/utils/calendar-date';

/**
 * Zeitraum des Dashboards.
 *
 * Jedes Widget hat sich das Datum zuvor selbst gebaut ("heute"). Damit
 * ließ sich der Zeitraum nicht umschalten, und jedes Widget hätte
 * seinen eigenen Stichtag berechnet. Der Zeitraum kommt jetzt von oben.
 */

export type RangeKey = 'today' | 'week' | 'event';

export interface DashboardRange {
  /** Welcher Zeitraum gewaehlt ist — die Widgets beschriften sich danach. */
  key: RangeKey;
  /**
   * Was an die API geht, und nur das.
   *
   * Getrennt vom Schluessel, weil die Berichts-Endpunkte unbekannte
   * Abfrageparameter mit 400 ablehnen. Solange der Schluessel neben
   * startDate und endDate im selben Objekt lag, reichte ein
   * `useHourlyReport(orgId, range)` aus, um ihn mitzuschicken — und
   * TypeScript sah nichts davon, weil ueberzaehlige Felder nur bei
   * Objektliteralen geprueft werden, nicht bei Variablen.
   */
  query: { startDate: string; endDate: string };
}

const RangeContext = createContext<DashboardRange | null>(null);

export function rangeFor(key: RangeKey, event?: { startDate?: string | null; endDate?: string | null }): DashboardRange {
  // Lokale Kalendertage — nicht über toISOString, das UTC nimmt.
  const heute = todayKey();
  if (key === 'week') {
    return { key, query: { startDate: addDays(heute, -6), endDate: heute } };
  }
  if (key === 'event' && event?.startDate) {
    /* Start und Ende sind Zeitpunkte (lokale Mitternacht, in UTC der
       Vorabend). slice(0, 10) nahm davon den UTC-Tag und schnitt so den
       letzten Veranstaltungstag ab. */
    return {
      key,
      query: {
        startDate: toDayKey(event.startDate),
        endDate: toDayKey(event.endDate ?? event.startDate),
      },
    };
  }
  /* Ohne laufende Veranstaltung faellt 'event' auf heute zurueck — dann
     ist auch die Beschriftung 'heute', sonst behauptete sie einen
     Zeitraum, der gar nicht abgefragt wurde. */
  return { key: 'today', query: { startDate: heute, endDate: heute } };
}

export function DashboardRangeProvider({
  value,
  children,
}: {
  value: DashboardRange;
  children: React.ReactNode;
}) {
  const stable = useMemo(() => value, [value.key, value.query.startDate, value.query.endDate]);
  return <RangeContext.Provider value={stable}>{children}</RangeContext.Provider>;
}

/** Zeitraum der Widgets. Ohne Provider gilt "heute". */
export function useDashboardRange(): DashboardRange {
  const ctx = useContext(RangeContext);
  const fallback = useMemo(() => rangeFor('today'), []);
  return ctx ?? fallback;
}
