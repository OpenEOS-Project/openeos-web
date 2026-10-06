'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { apiClient, ordersApi } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/runtime-config';
import { tablesApi, type TableLayoutPatch } from '@/lib/tables-api';
import type {
  BulkCreateDiningTablesData,
  CreateDiningTableData,
  CreateTableAreaData,
  DiningTable,
  TableArea,
  UpdateDiningTableData,
  UpdateTableAreaData,
} from '@/types/table';
import { toTableKey } from '@/types/table';

/**
 * Bereiche und Tische der Organisation (Verwaltung). Ein einziger Cache
 * `['tableAreas', orgId]` hält alle Bereiche samt Tischen — die API liefert
 * sie in einem Aufruf, und Seite, Event-Dialog und Geräteeinstellungen
 * brauchen dieselbe Liste.
 *
 * Mutationen wiederholen nicht (`retry: false`): eine Serie, die beim
 * ersten Mal mit 409 abgelehnt wurde, wird es beim zweiten Mal wieder.
 */
export const tableKeys = {
  all: ['tableAreas'] as const,
  areas: (organizationId: string) => [...tableKeys.all, organizationId] as const,
  openOrders: (organizationId: string, eventId: string) =>
    ['tableOpenOrders', organizationId, eventId] as const,
};

export function useTableAreas(organizationId: string) {
  return useQuery({
    queryKey: tableKeys.areas(organizationId),
    queryFn: async () => (await tablesApi.listAreas(organizationId)).data,
    enabled: !!organizationId,
  });
}

/** Ersetzt einen Bereich (oder einen Tisch darin) im Cache, ohne neu zu laden. */
export function patchAreasCache(
  areas: TableArea[] | undefined,
  update: (area: TableArea) => TableArea,
  areaId?: string,
): TableArea[] | undefined {
  if (!areas) return areas;
  return areas.map((area) => (!areaId || area.id === areaId ? update(area) : area));
}

function useInvalidateAreas(organizationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tableKeys.areas(organizationId) });
}

export function useCreateTableArea(organizationId: string) {
  const invalidate = useInvalidateAreas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async (data: CreateTableAreaData) =>
      (await tablesApi.createArea(organizationId, data)).data,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTableArea(organizationId: string) {
  const invalidate = useInvalidateAreas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async ({ areaId, data }: { areaId: string; data: UpdateTableAreaData }) =>
      (await tablesApi.updateArea(organizationId, areaId, data)).data,
    onSuccess: () => invalidate(),
  });
}

export function useReorderTableAreas(organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAreas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async (ids: string[]) => (await tablesApi.reorderAreas(organizationId, ids)).data,
    onMutate: (ids) => {
      queryClient.setQueryData<TableArea[]>(tableKeys.areas(organizationId), (areas) =>
        areas
          ? [...areas].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
          : areas,
      );
    },
    onSettled: () => invalidate(),
  });
}

export function useDeleteTableArea(organizationId: string) {
  const invalidate = useInvalidateAreas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async (areaId: string) => {
      await tablesApi.deleteArea(organizationId, areaId);
      return areaId;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCreateTable(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (data: CreateDiningTableData) =>
      (await tablesApi.createTable(organizationId, data)).data,
    onSuccess: (table) => {
      // Sofort sichtbar (und wählbar), bevor die Liste neu geladen ist.
      queryClient.setQueryData<TableArea[]>(tableKeys.areas(organizationId), (areas) =>
        patchAreasCache(areas, (area) => ({ ...area, tables: [...area.tables, table] }), table.areaId),
      );
      queryClient.invalidateQueries({ queryKey: tableKeys.areas(organizationId) });
    },
  });
}

export function useBulkCreateTables(organizationId: string) {
  const invalidate = useInvalidateAreas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async (data: BulkCreateDiningTablesData) =>
      (await tablesApi.bulkCreate(organizationId, data)).data,
    onSuccess: () => invalidate(),
  });
}

/**
 * Stammfelder eines Tisches (Bezeichnung, Plätze, Aktiv, Bereich).
 * Optimistisch: der Cache ändert sich sofort und springt bei einem Fehler
 * zurück; die Fehlermeldung zeigt der Aufrufer.
 */
export function useUpdateTable(organizationId: string) {
  const queryClient = useQueryClient();
  const key = tableKeys.areas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async ({ tableId, data }: { tableId: string; data: UpdateDiningTableData }) =>
      (await tablesApi.updateTable(organizationId, tableId, data)).data,
    onMutate: async ({ tableId, data }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TableArea[]>(key);
      queryClient.setQueryData<TableArea[]>(key, (areas) => {
        if (!areas) return areas;
        const table = areas.flatMap((a) => a.tables).find((t) => t.id === tableId);
        if (!table) return areas;
        const next: DiningTable = { ...table, ...data, seats: data.seats === undefined ? table.seats : data.seats };
        return areas.map((area) => {
          const without = area.tables.filter((t) => t.id !== tableId);
          if (area.id === next.areaId) {
            const index = area.tables.findIndex((t) => t.id === tableId);
            const tables = index === -1 ? [...without, next] : area.tables.map((t) => (t.id === tableId ? next : t));
            return { ...area, tables };
          }
          return without.length === area.tables.length ? area : { ...area, tables: without };
        });
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteTable(organizationId: string) {
  const queryClient = useQueryClient();
  const key = tableKeys.areas(organizationId);
  return useMutation({
    retry: false,
    mutationFn: async (tableId: string) => {
      await tablesApi.deleteTable(organizationId, tableId);
      return tableId;
    },
    onSuccess: (tableId) => {
      queryClient.setQueryData<TableArea[]>(key, (areas) =>
        patchAreasCache(areas, (area) => ({ ...area, tables: area.tables.filter((t) => t.id !== tableId) })),
      );
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** PUT …/layout; der Aufrufer (Autosave) setzt den Cache selbst. */
export function saveTableLayout(organizationId: string, areaId: string, data: TableLayoutPatch) {
  return tablesApi.saveLayout(organizationId, areaId, data).then((res) => res.data);
}

/**
 * Offene Bestellungen je Tischschlüssel in der aktiven Veranstaltung — für
 * die Spalte „Offen“ der Liste. Die Verwaltung hat keinen eigenen
 * Status-Endpunkt; zwei Abfragen (unbezahlt, teilbezahlt) mit je bis zu
 * 100 Bestellungen reichen für die Übersicht.
 */
export function useOpenTableOrders(organizationId: string, eventId: string | undefined) {
  const query = useQuery({
    queryKey: tableKeys.openOrders(organizationId, eventId ?? ''),
    queryFn: async () => {
      const [unpaid, partly] = await Promise.all(
        (['unpaid', 'partly_paid'] as const).map((paymentStatus) =>
          ordersApi.list(organizationId, { eventId, paymentStatus, limit: 100 }),
        ),
      );
      return [...(unpaid.data ?? []), ...(partly.data ?? [])];
    },
    enabled: !!organizationId && !!eventId,
    staleTime: 15_000,
  });

  return useMemo(() => {
    const byTableId = new Map<string, number>();
    const byKey = new Map<string, number>();
    for (const order of query.data ?? []) {
      if (order.status === 'cancelled' || order.status === 'completed') continue;
      const tableId = (order as { tableId?: string | null }).tableId;
      if (tableId) byTableId.set(tableId, (byTableId.get(tableId) ?? 0) + 1);
      else if (order.tableNumber) {
        const key = toTableKey(order.tableNumber);
        byKey.set(key, (byKey.get(key) ?? 0) + 1);
      }
    }
    return {
      isLoading: query.isLoading,
      countFor: (table: Pick<DiningTable, 'id' | 'label'>) =>
        (byTableId.get(table.id) ?? 0) + (byKey.get(toTableKey(table.label)) ?? 0),
    };
  }, [query.data, query.isLoading]);
}

/**
 * Lädt Bereiche neu, wenn jemand anderes sie ändert (`tablesUpdated` im
 * Organisationsraum). Gleichzeitiges Bearbeiten zweier Admins bleibt
 * „last write wins“ — so sieht aber jeder zeitnah den Stand des anderen.
 * `isBusy` verhindert, dass ein Neuladen mitten in eine eigene,
 * noch nicht gespeicherte Änderung fällt.
 */
export function useTablesLiveUpdates(organizationId: string, isBusy: () => boolean) {
  const queryClient = useQueryClient();
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;

  useEffect(() => {
    if (!organizationId || typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const socket: Socket = io(getApiBaseUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Als Funktion: bei jedem Wiederverbinden das aktuelle Token.
      auth: (cb) => cb({ token: apiClient.getAccessToken() ?? undefined }),
      reconnectionDelayMax: 10_000,
    });
    const join = () => socket.emit('joinRoom', { organizationId });
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(function retry() {
        if (busyRef.current()) {
          timer = setTimeout(retry, 800);
          return;
        }
        queryClient.invalidateQueries({ queryKey: tableKeys.areas(organizationId) });
      }, 300);
    };
    socket.on('connected', join);
    socket.on('tablesUpdated', refresh);
    return () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [organizationId, queryClient]);
}
