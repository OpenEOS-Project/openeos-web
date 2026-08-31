'use client';

import { createContext, useContext, useMemo } from 'react';

/**
 * Zeitraum des Dashboards.
 *
 * Jedes Widget hat sich das Datum zuvor selbst gebaut ("heute"). Damit
 * ließ sich der Zeitraum nicht umschalten, und jedes Widget hätte
 * seinen eigenen Stichtag berechnet. Der Zeitraum kommt jetzt von oben.
 */

export type RangeKey = 'today' | 'week' | 'event';

export interface DashboardRange {
  startDate: string;
  endDate: string;
}

const RangeContext = createContext<DashboardRange | null>(null);

/** Lokales Datum als YYYY-MM-DD — nicht über toISOString, das UTC nimmt
 *  und in unserer Zeitzone abends auf den Folgetag springt. */
function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function rangeFor(key: RangeKey, event?: { startDate?: string | null; endDate?: string | null }): DashboardRange {
  const heute = new Date();
  if (key === 'week') {
    const von = new Date(heute);
    von.setDate(von.getDate() - 6);
    return { startDate: isoDate(von), endDate: isoDate(heute) };
  }
  if (key === 'event' && event?.startDate) {
    return {
      startDate: event.startDate.slice(0, 10),
      endDate: (event.endDate ?? event.startDate).slice(0, 10),
    };
  }
  return { startDate: isoDate(heute), endDate: isoDate(heute) };
}

export function DashboardRangeProvider({
  value,
  children,
}: {
  value: DashboardRange;
  children: React.ReactNode;
}) {
  const stable = useMemo(() => value, [value.startDate, value.endDate]);
  return <RangeContext.Provider value={stable}>{children}</RangeContext.Provider>;
}

/** Zeitraum der Widgets. Ohne Provider gilt "heute". */
export function useDashboardRange(): DashboardRange {
  const ctx = useContext(RangeContext);
  const fallback = useMemo(() => rangeFor('today'), []);
  return ctx ?? fallback;
}
