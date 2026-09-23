'use client';

import { useQuery } from '@tanstack/react-query';

import { eventsApi } from '@/lib/api-client';

/**
 * Was eine Veranstaltung mit diesem Zeitraum kosten wird.
 *
 * Gefragt wird, sobald ein Beginn feststeht — der Preis soll beim Anlegen
 * dastehen und nicht erst im Bezahldialog. Ein Kunde richtete zu viert
 * einen Abend lang ein und bemerkte „fast durch Zufall", dass pro Tag
 * gezahlt wird.
 *
 * Gerechnet wird auf dem Server, weil Sonderpreise und Nachlässe dort
 * liegen; eine zweite Rechnung im Browser würde früher oder später etwas
 * anderes sagen als die Rechnung.
 */
export function useEventPricePreview(
  organizationId: string | undefined,
  start: string | undefined,
  end: string | undefined,
) {
  const { data } = useQuery({
    queryKey: ['event-price-preview', organizationId, start, end ?? start],
    queryFn: async () => (await eventsApi.previewPrice(organizationId!, start!, end)).data,
    enabled: !!organizationId && !!start,
    // Ändert sich nur, wenn jemand den Tagespreis umstellt.
    staleTime: 10 * 60 * 1000,
  });

  return data ?? null;
}
