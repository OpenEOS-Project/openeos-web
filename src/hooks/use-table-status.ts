'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceTablesApi } from '@/lib/device-tables-api';

/** Ohne Live-Verbindung alle 15 s, sonst als Sicherheitsnetz jede Minute. */
const POLL_OFFLINE_MS = 15_000;
const POLL_LIVE_MS = 60_000;

/**
 * Status der nicht freien Tische (offen / wartet). Socket-Ereignisse zu
 * Bestellungen und Zahlungen invalidieren `['device-table-status']`
 * (entprellt); ohne Socket greift das Polling.
 */
export function useTableStatus(eventId: string | null, { enabled, live }: { enabled: boolean; live: boolean }) {
  const query = useQuery({
    queryKey: ['device-table-status', eventId],
    queryFn: async () => (await deviceTablesApi.getStatus(eventId)).data,
    enabled: enabled && !!eventId,
    refetchInterval: live ? POLL_LIVE_MS : POLL_OFFLINE_MS,
  });
  return {
    status: query.data ?? [],
    isLoading: query.isLoading,
    updatedAt: query.dataUpdatedAt || null,
  };
}
