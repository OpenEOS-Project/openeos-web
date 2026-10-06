'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BroadcastMessage } from '@/hooks/use-device-socket';
import { deviceTablesApi } from '@/lib/device-tables-api';
import { useDeviceStore } from '@/stores/device-store';
import type { Product } from '@/types/product';
import type { PosPrinterStatus } from '../components/pos-header';

interface ProductUpdatedPayload {
  product: {
    id: string;
    name: string;
    categoryId: string | null;
    price: number;
    isAvailable: boolean;
    isActive: boolean;
    stockQuantity?: number;
    trackInventory: boolean;
  };
  eventId: string;
}

/**
 * Steht die Live-Verbindung (Socket)? Abfragen offener Bestellungen pollen
 * nur ohne sie (Spezifikation §5.5).
 */
const PosLiveContext = createContext(false);
export const PosLiveProvider = PosLiveContext.Provider;
export function usePosLive() {
  return useContext(PosLiveContext);
}

/** Bestellungen, Zahlungen, Positionsstatus: gesammelt nach 300 ms neu laden. */
const ORDER_DEBOUNCE_MS = 300;
const ORDER_QUERIES = ['device-table-status', 'device-open-orders', 'device-order-history', 'device-orders'] as const;

/** Alle Abfragen, die nach einem Wiederverbinden neu geladen werden. */
const RECONNECT_QUERIES = [
  'device-products',
  'device-categories',
  'device-orders',
  'device-organization',
  'device-events',
  'device-status',
  'device-tables',
  'device-table-status',
  'device-open-orders',
  'device-order-history',
] as const;

/**
 * Socket-Abos der Kasse: Produkt-, Menü- und Geräteereignisse sowie
 * Bestellungen/Zahlungen (Tischstatus, offene Bestellungen) und Tische;
 * beim (Wieder-)Verbinden alles Relevante neu laden, weil Ereignisse aus
 * der Trennzeit verloren sind.
 */
export function usePosSocketEvents(eventId: string | null, onBroadcast: (message: BroadcastMessage) => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const refreshDevice = useCallback(() => {
    useDeviceStore.getState().checkStatus();
  }, []);

  const orderTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (orderTimer.current) window.clearTimeout(orderTimer.current);
    },
    [],
  );
  const ordersChanged = useCallback(
    (data: unknown) => {
      const payloadEvent = (data as { eventId?: string } | null)?.eventId;
      if (payloadEvent && eventId && payloadEvent !== eventId) return;
      if (orderTimer.current) window.clearTimeout(orderTimer.current);
      orderTimer.current = window.setTimeout(() => {
        orderTimer.current = null;
        for (const key of ORDER_QUERIES) queryClient.invalidateQueries({ queryKey: [key] });
      }, ORDER_DEBOUNCE_MS);
    },
    [eventId, queryClient],
  );

  const on = useMemo(
    () => ({
      productUpdated: (data: unknown) => {
        const payload = data as ProductUpdatedPayload;
        if (!payload?.product?.id || payload.eventId !== eventId) return;
        queryClient.setQueryData(['device-products', eventId], (old: { data: Product[] } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((p) =>
              p.id === payload.product.id
                ? {
                    ...p,
                    name: payload.product.name,
                    categoryId: payload.product.categoryId ?? p.categoryId,
                    price: payload.product.price,
                    isAvailable: payload.product.isAvailable,
                    isActive: payload.product.isActive,
                    stockQuantity: payload.product.stockQuantity ?? p.stockQuantity,
                    trackInventory: payload.product.trackInventory,
                  }
                : p,
            ),
          };
        });
      },
      productDeleted: (data: unknown) => {
        const payload = data as { productId?: string; eventId?: string };
        if (!payload?.productId || payload.eventId !== eventId) return;
        queryClient.setQueryData(['device-products', eventId], (old: { data: Product[] } | undefined) =>
          old?.data ? { ...old, data: old.data.filter((p) => p.id !== payload.productId) } : old,
        );
      },
      menuRefresh: (data: unknown) => {
        const payload = data as { eventId?: string; reason?: string };
        if (payload?.eventId && payload.eventId !== eventId) return;
        queryClient.invalidateQueries({ queryKey: ['device-products', eventId] });
        queryClient.invalidateQueries({ queryKey: ['device-categories', eventId] });
        if (payload?.reason === 'event-settings') {
          queryClient.invalidateQueries({ queryKey: ['device-events'] });
          queryClient.invalidateQueries({ queryKey: ['device-tables'] });
        }
      },
      orderCreated: ordersChanged,
      orderUpdated: ordersChanged,
      paymentReceived: ordersChanged,
      orderItemStatusChanged: ordersChanged,
      tablesUpdated: () => {
        queryClient.invalidateQueries({ queryKey: ['device-tables'] });
        queryClient.invalidateQueries({ queryKey: ['device-table-status'] });
      },
      deviceConfigUpdated: refreshDevice,
      deviceSettingsUpdated: refreshDevice,
      deviceStatusChanged: (data: unknown) => {
        if ((data as { status?: string })?.status === 'blocked') {
          router.replace('/device/register');
          return;
        }
        refreshDevice();
      },
      printerStatusChanged: () => queryClient.invalidateQueries({ queryKey: ['device-status'] }),
    }),
    [eventId, queryClient, refreshDevice, router, ordersChanged],
  );

  const onConnect = useCallback(() => {
    for (const key of RECONNECT_QUERIES) queryClient.invalidateQueries({ queryKey: [key] });
    refreshDevice();
  }, [queryClient, refreshDevice]);

  return useMemo(() => ({ onBroadcast, onConnect, on }), [onBroadcast, onConnect, on]);
}

/**
 * Zustand des Bondruckers aus `GET /device-api/status` (Antwort in `data`
 * verpackt: `{ printer, tse }`). Ohne zugewiesenen Drucker (`printer: null`)
 * bleibt die Pille aus; bei einem Fehler wird nicht erneut gefragt.
 */
export function usePosDeviceStatus(): PosPrinterStatus | null {
  const { data, isError } = useQuery({
    queryKey: ['device-status'],
    queryFn: () => deviceTablesApi.getDeviceStatus(),
    retry: false,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.status === 'error' ? false : 60_000),
    refetchOnWindowFocus: false,
  });
  if (isError) return null;
  const printer = data?.data?.printer;
  return printer ? { name: printer.name, isOnline: printer.isOnline } : null;
}
