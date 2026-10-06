'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceTablesApi } from '@/lib/device-tables-api';
import type { Order } from '@/types/order';
import { usePosLive } from './use-pos-live';

/** Welche offenen Bestellungen: die eines Tisches oder die ohne Tisch (Theke/To-go). */
export type OpenOrdersScope = { kind: 'table'; tableKey: string } | { kind: 'counter' };

const EMPTY: Order[] = [];

export function openOrdersScopeKey(scope: OpenOrdersScope | null): string {
  if (!scope) return 'none';
  return scope.kind === 'table' ? `table:${scope.tableKey}` : 'counter';
}

/**
 * Offene (unbezahlte/teilbezahlte) Bestellungen eines Kontexts im aktiven
 * Event. Socket-Ereignisse invalidieren `['device-open-orders']`; ohne
 * Live-Verbindung wird alle 15 s nachgefragt.
 */
export function useOpenOrders(eventId: string | null, scope: OpenOrdersScope | null, enabled = true) {
  const live = usePosLive();
  const query = useQuery({
    queryKey: ['device-open-orders', eventId, openOrdersScopeKey(scope)],
    queryFn: async () =>
      (
        await deviceTablesApi.getOpenOrders({
          eventId: eventId ?? undefined,
          ...(scope?.kind === 'table'
            ? { tableKey: scope.tableKey }
            : { fulfillmentType: 'counter_pickup' as const }),
        })
      ).data,
    enabled: enabled && !!eventId && !!scope,
    refetchInterval: live ? false : 15_000,
  });
  return { orders: query.data ?? EMPTY, isLoading: query.isLoading, refetch: query.refetch };
}
