'use client';

import { useCallback, useState } from 'react';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { deviceApi } from '@/lib/api-client';

import { useDeviceStore } from '@/stores/device-store';

import type {
  DeviceActor,
  HistoryPaymentFilter,
  OrderDisplayStatus,
  OrderHistoryCounts,
  OrderHistoryRow,
  RefundPermission,
} from '@/types/order-history';

import { errorReason } from './use-pos-checkout';

export interface HistoryFilters {
  q: string;
  statuses: OrderDisplayStatus[];
  payments: HistoryPaymentFilter[];
  scope: 'device' | 'all';
  /** `today`: ab lokalem Tagesbeginn, `event`: ganze Veranstaltung. */
  range: 'today' | 'event';
}

export const DEFAULT_FILTERS: HistoryFilters = {
  q: '',
  statuses: [],
  payments: [],
  scope: 'all',
  range: 'event',
};

const PAGE_SIZE = 40;

/**
 * Bestellverlauf mit Filtern und Seiten vom Server („Mehr laden“ /
 * Endlos-Scroll). Der Schlüssel beginnt mit `device-order-history`, damit
 * Echtzeit-Ereignisse (use-pos-live) die Liste neu laden.
 */
export function useOrderHistory(
  eventId: string | null,
  filters: HistoryFilters,
  from: string | null,
  enabled: boolean
) {
  const query = useInfiniteQuery({
    queryKey: ['device-order-history', 'list', eventId, filters, from],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      deviceApi.getOrderHistory({
        eventId: eventId ?? undefined,
        q: filters.q.trim() || undefined,
        displayStatus: filters.statuses,
        paymentMethod: filters.payments,
        scope: filters.scope,
        from: filters.range === 'today' && from ? from : undefined,
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (last) => last.meta?.nextCursor ?? null,
    enabled,
    staleTime: 5_000,
  });
  const rows: OrderHistoryRow[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const counts: OrderHistoryCounts | null = query.data?.pages[0]?.meta.counts ?? null;
  return { ...query, rows, counts };
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['device-order-history', 'detail', orderId],
    queryFn: async () => (await deviceApi.getOrderDetail(orderId!)).data,
    enabled: !!orderId,
  });
}

export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    for (const key of [
      'device-order-history',
      'device-open-orders',
      'device-table-status',
      'device-orders',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);
}

const PIN_ERRORS = new Set(['PIN_INVALID', 'REFUND_PIN_NOT_AUTHORIZED', 'REFUND_PIN_REQUIRED']);

/** PIN abgelehnt: der Fehler bleibt im PIN-Blatt, alles andere zeigt die Aktion. */
export function isPinError(error: unknown): boolean {
  const reason = errorReason(error);
  return !!reason && PIN_ERRORS.has(reason);
}

/**
 * Berechtigung „Stornieren & Erstatten“ der Kasse. `run(action)` führt die
 * Aktion direkt aus (erlaubt) oder fragt zuerst eine PIN ab (nur mit PIN)
 * und gibt sie mit. Eine abgelehnte PIN bleibt im PIN-Blatt stehen.
 */
export function useRefundGate() {
  const { settings, session } = useDeviceStore();
  const permission = ((settings?.refundPermission as RefundPermission | undefined) ??
    'allowed') as RefundPermission;
  const [pending, setPending] = useState<((actor: DeviceActor) => Promise<void>) | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: (actor: DeviceActor) => Promise<void>) => {
      if (permission === 'pin') {
        setPinError(null);
        setPending(() => action);
        return;
      }
      await action(session?.userId ? { operatorUserId: session.userId } : {});
    },
    [permission, session?.userId]
  );

  const submitPin = useCallback(
    async (pin: string) => {
      if (!pending) return;
      setBusy(true);
      setPinError(null);
      try {
        await pending({ pin });
        setPending(null);
      } catch (error) {
        const reason = errorReason(error);
        if (reason && PIN_ERRORS.has(reason)) setPinError(reason);
        else setPending(null);
      } finally {
        setBusy(false);
      }
    },
    [pending]
  );

  return {
    permission,
    run,
    pin: {
      open: pending !== null,
      error: pinError,
      busy,
      submit: submitPin,
      close: () => setPending(null),
    },
  };
}
