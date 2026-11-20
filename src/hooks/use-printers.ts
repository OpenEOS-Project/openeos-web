'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { sessionSocketOptions } from '@/lib/session-socket';

import { apiClient, printerAgentsApi, printJobsApi, printersApi } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/runtime-config';
import type { PrintHealth } from '@/types/print-health';
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
  health: (organizationId: string) => ['print-health', organizationId] as const,
};

/**
 * Fallback cadence of the print health: the API announces changes
 * (`printHealthChanged`) every 30 s at most, so polling at the same pace
 * only matters when the socket is down.
 */
export const PRINT_HEALTH_POLL_INTERVAL_MS = 30_000;

/**
 * Print health of the organization (agents offline, jobs waiting or
 * failed). With `live` (default) it opens its own socket and refetches on
 * `printHealthChanged`, `printerStatusChanged` and `printJobStatusChanged`;
 * pages that already run `usePrinterLiveUpdates` pass `live: false`.
 */
export function usePrintHealth(organizationId: string, options: { live?: boolean } = {}) {
  const live = options.live ?? true;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!live || !organizationId || typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const socket: Socket = io(getApiBaseUrl(), sessionSocketOptions(() => apiClient.getAccessToken()));
    const join = () => socket.emit('joinRoom', { organizationId });
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: printerKeys.health(organizationId) });
      }, 500);
    };
    socket.on('connected', join);
    socket.on('printHealthChanged', refresh);
    socket.on('printerStatusChanged', refresh);
    socket.on('printJobStatusChanged', refresh);
    return () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [live, organizationId, queryClient]);

  return useQuery({
    queryKey: printerKeys.health(organizationId),
    queryFn: async () => {
      const res = await printJobsApi.health(organizationId);
      return res.data as unknown as PrintHealth;
    },
    enabled: !!organizationId,
    refetchInterval: PRINT_HEALTH_POLL_INTERVAL_MS,
    // A failing health check must never get in the way of the page.
    retry: false,
  });
}

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
    const socket: Socket = io(
      getApiBaseUrl(),
      sessionSocketOptions(() => apiClient.getAccessToken()),
    );
    const join = () => socket.emit('joinRoom', { organizationId });
    const refresh = () => {
      clearTimeout(timer);
      // Several status events arrive in a burst after a heartbeat — one refetch is enough.
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: printerKeys.printers(organizationId) });
        queryClient.invalidateQueries({ queryKey: printerKeys.agents(organizationId) });
        queryClient.invalidateQueries({ queryKey: printerKeys.health(organizationId) });
      }, 300);
    };
    socket.on('connected', join);
    socket.on('printerStatusChanged', refresh);
    socket.on('printJobStatusChanged', refresh);
    socket.on('printHealthChanged', refresh);
    return () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [organizationId, queryClient]);
}
