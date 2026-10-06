'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceTablesApi } from '@/lib/device-tables-api';

/**
 * Tischmodus und Tische (nach Bereichen) des aktiven Events für die Kasse.
 * `tablesUpdated` und Event-Einstellungen invalidieren `['device-tables']`.
 */
export function useDeviceTables(eventId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['device-tables', eventId],
    queryFn: async () => (await deviceTablesApi.getTables(eventId)).data,
    enabled: enabled && !!eventId,
    staleTime: 5 * 60_000,
  });
}
