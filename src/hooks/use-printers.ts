'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { apiClient, printerAgentsApi, printersApi } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/runtime-config';
import type {
  AdoptDiscoveredPrinterData,
  CreatePrinterData,
  DiscoverPrintersData,
  DiscoveredPrinter,
  Printer,
  PrinterAgent,
  UpdatePrinterData,
} from '@/types/printer';

export const printerKeys = {
  printers: (organizationId: string) => ['printers', organizationId] as const,
  agents: (organizationId: string) => ['printer-agents', organizationId] as const,
  // Own root on purpose: invalidating the agents list must not refetch the
  // discovered list of an agent that was just removed (404 race).
  discovered: (organizationId: string, deviceId: string) =>
    ['discovered-printers', organizationId, deviceId] as const,
};

/**
 * Fallback cadence when the socket is not connected (or an event got lost):
 * the agent heartbeats every 30 s, so 10 s keeps the page close to live
 * without hammering the API.
 */
export const PRINTER_POLL_INTERVAL_MS = 10_000;

export function usePrinters(organizationId: string, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: printerKeys.printers(organizationId),
    queryFn: async () => {
      const res = await printersApi.list(organizationId);
      return res.data as unknown as Printer[];
    },
    enabled: !!organizationId,
    refetchInterval: options.live ? PRINTER_POLL_INTERVAL_MS : false,
  });
}

export function useCreatePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePrinterData) => printersApi.create(organizationId, data),
    onSuccess: () => invalidatePrinterQueries(queryClient, organizationId),
  });
}

export function useUpdatePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ printerId, data }: { printerId: string; data: UpdatePrinterData }) =>
      printersApi.update(organizationId, printerId, data),
    onSuccess: () => invalidatePrinterQueries(queryClient, organizationId),
  });
}

export function useDeletePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (printerId: string) => printersApi.delete(organizationId, printerId),
    onSuccess: () => invalidatePrinterQueries(queryClient, organizationId),
  });
}

export function useTestPrint(organizationId: string) {
  return useMutation({
    mutationFn: (printerId: string) => printersApi.testPrint(organizationId, printerId),
  });
}

// ---------------------------------------------------------------------------
// Printer agents
// ---------------------------------------------------------------------------

export function usePrinterAgents(organizationId: string, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: printerKeys.agents(organizationId),
    queryFn: async () => {
      const res = await printerAgentsApi.list(organizationId);
      return res.data as unknown as PrinterAgent[];
    },
    enabled: !!organizationId,
    refetchInterval: options.live ? PRINTER_POLL_INTERVAL_MS : false,
  });
}

export function useDiscoveredPrinters(
  organizationId: string,
  deviceId: string,
  options: { live?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: printerKeys.discovered(organizationId, deviceId),
    queryFn: async () => {
      const res = await printerAgentsApi.listDiscovered(organizationId, deviceId);
      return res.data as unknown as DiscoveredPrinter[];
    },
    enabled: !!organizationId && !!deviceId && options.enabled !== false,
    refetchInterval: options.live ? PRINTER_POLL_INTERVAL_MS : false,
  });
}

export function useRemovePrinterAgent(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => printerAgentsApi.remove(organizationId, deviceId),
    onSuccess: () => {
      invalidatePrinterQueries(queryClient, organizationId);
      // Assignments (stations, order flow, device settings) were cleared by the API.
      queryClient.invalidateQueries({ queryKey: ['productionStations'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device'] });
    },
  });
}

export function useDiscoverPrinters(organizationId: string) {
  return useMutation({
    mutationFn: ({ deviceId, data }: { deviceId: string; data?: DiscoverPrintersData }) =>
      printerAgentsApi.discover(organizationId, deviceId, data ?? {}),
  });
}

export function useAdoptDiscoveredPrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      deviceId,
      discoveredId,
      data,
    }: {
      deviceId: string;
      discoveredId: string;
      data: AdoptDiscoveredPrinterData;
    }) => printerAgentsApi.adopt(organizationId, deviceId, discoveredId, data),
    onSuccess: () => invalidatePrinterQueries(queryClient, organizationId),
  });
}

function invalidatePrinterQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
) {
  queryClient.invalidateQueries({ queryKey: printerKeys.printers(organizationId) });
  queryClient.invalidateQueries({ queryKey: printerKeys.agents(organizationId) });
}

/**
 * Keeps agents, printers and discovered printers fresh while the page is
 * open: the API emits `printerStatusChanged` (printer online/offline) into
 * the organisation room; anything else — an agent connecting, a scan
 * reporting new printers — is picked up by the 10 s polling the queries
 * above run with `live: true`. The socket only shortens the wait for the
 * common case.
 */
export function usePrinterLiveUpdates(organizationId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const socket: Socket = io(getApiBaseUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // As a function: the current token on every reconnect.
      auth: (cb) => cb({ token: apiClient.getAccessToken() ?? undefined }),
      reconnectionDelayMax: 10_000,
    });
    const join = () => socket.emit('joinRoom', { organizationId });
    const refresh = () => {
      clearTimeout(timer);
      // Several status events arrive in a burst after a heartbeat — one refetch is enough.
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: printerKeys.printers(organizationId) });
        queryClient.invalidateQueries({ queryKey: printerKeys.agents(organizationId) });
      }, 300);
    };
    socket.on('connected', join);
    socket.on('printerStatusChanged', refresh);
    socket.on('printJobStatusChanged', refresh);
    return () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [organizationId, queryClient]);
}
