'use client';

import { useEffect } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Socket, io } from 'socket.io-client';

import { assistantKeys } from '@/hooks/use-assistant';
import { categoryKeys } from '@/hooks/use-categories';
import { productKeys } from '@/hooks/use-products';

import { apiClient, menuImportsApi } from '@/lib/api-client';
import { menuImportPending } from '@/lib/menu-import';
import { getApiBaseUrl } from '@/lib/runtime-config';

import type { ApplyMenuImportData, CreateMenuImportInput, MenuImport } from '@/types/assistant';

export const menuImportKeys = {
  all: ['menu-imports'] as const,
  list: (eventId: string) => [...menuImportKeys.all, 'list', eventId] as const,
  detail: (eventId: string, id: string) => [...menuImportKeys.all, 'detail', eventId, id] as const,
};

/** Abstand des Pollens, solange ein Import `queued` oder `processing` ist. */
export const MENU_IMPORT_POLL_INTERVAL_MS = 2_000;

/**
 * Ein Import mit Vorschlag. Solange er läuft, fragt die Abfrage alle 2 s
 * nach; das Socket-Ereignis `menuImportUpdated` (Organisations-Raum) zieht
 * das Ergebnis früher nach, wenn es ankommt.
 */
export function useMenuImport(organizationId: string, eventId: string, id: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: menuImportKeys.detail(eventId, id ?? ''),
    queryFn: async () => {
      const response = await menuImportsApi.get(organizationId, eventId, id!);
      return response.data;
    },
    enabled: !!organizationId && !!eventId && !!id,
    refetchInterval: (state) =>
      menuImportPending(state.state.data?.status) ? MENU_IMPORT_POLL_INTERVAL_MS : false,
  });

  const pending = !!id && menuImportPending(query.data?.status);
  const status = query.data?.status;

  // Ein gescheiterter Aufruf kostet kein Kontingent (die Reservierung wird
  // zurückgebucht) — die Anzeige im Dialog und in den Einstellungen nachziehen.
  useEffect(() => {
    if (status === 'failed' || status === 'done') {
      queryClient.invalidateQueries({ queryKey: assistantKeys.status(organizationId) });
    }
  }, [status, organizationId, queryClient]);

  useEffect(() => {
    if (!pending || !organizationId || typeof window === 'undefined') return;
    const socket: Socket = io(getApiBaseUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: apiClient.getAccessToken() ?? undefined }),
      reconnectionDelayMax: 10_000,
    });
    const join = () => socket.emit('joinRoom', { organizationId });
    const onUpdate = (event: { id: string; eventId: string; status: MenuImport['status'] }) => {
      if (event.id !== id) return;
      queryClient.invalidateQueries({ queryKey: menuImportKeys.detail(eventId, id) });
    };
    socket.on('connected', join);
    socket.on('menuImportUpdated', onUpdate);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [pending, organizationId, eventId, id, queryClient]);

  return query;
}

export function useMenuImports(organizationId: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: menuImportKeys.list(eventId),
    queryFn: async () => {
      const response = await menuImportsApi.list(organizationId, eventId);
      return response.data;
    },
    enabled: enabled && !!organizationId && !!eventId,
  });
}

export function useCreateMenuImport(organizationId: string, eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMenuImportInput) => {
      const response = await menuImportsApi.create(organizationId, eventId, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuImportKeys.list(eventId) });
      // Die Reservierung zählt sofort gegen das Tageskontingent.
      queryClient.invalidateQueries({ queryKey: assistantKeys.status(organizationId) });
    },
  });
}

export function useApplyMenuImport(organizationId: string, eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ApplyMenuImportData }) => {
      const response = await menuImportsApi.apply(organizationId, eventId, id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: menuImportKeys.list(eventId) });
      queryClient.invalidateQueries({ queryKey: menuImportKeys.detail(eventId, id) });
    },
  });
}

export function useDeleteMenuImport(organizationId: string, eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => menuImportsApi.remove(organizationId, eventId, id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: menuImportKeys.detail(eventId, id) });
      queryClient.invalidateQueries({ queryKey: menuImportKeys.list(eventId) });
    },
  });
}
