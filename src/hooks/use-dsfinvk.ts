import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cashbookApi, deviceApi, dsfinvkApi } from '@/lib/api-client';
import type { CreateCashbookEntryData, DsfinvkClosingsQuery } from '@/types/dsfinvk';

/** Abfrageschlüssel für Kassenabschlüsse und Kassenbuch je Organisation. */
export const dsfinvkKeys = {
  all: (organizationId: string) => ['dsfinvk', organizationId] as const,
  closings: (organizationId: string, query: DsfinvkClosingsQuery) =>
    ['dsfinvk', organizationId, 'closings', query] as const,
  cashbookAll: (organizationId: string) => ['cashbook', organizationId] as const,
  cashbook: (organizationId: string, date: string | undefined) => ['cashbook', organizationId, date ?? 'today'] as const,
  device: ['device-cashbook'] as const,
};

export function useDsfinvkClosings(organizationId: string | undefined, query: DsfinvkClosingsQuery = {}, enabled = true) {
  return useQuery({
    queryKey: dsfinvkKeys.closings(organizationId ?? '', query),
    queryFn: async () => (await dsfinvkApi.closings(organizationId!, query)).data,
    enabled: !!organizationId && enabled,
    placeholderData: (previous) => previous,
  });
}

/** „Kassenabschluss jetzt erstellen“ — danach Liste neu laden. */
export function useCreateClosing(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await dsfinvkApi.createClosing(organizationId!)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: dsfinvkKeys.all(organizationId ?? '') }),
  });
}

/** Kassenbuch eines Geschäftstags (ganze Kasse, je Gerät aufgeschlüsselt). */
export function useCashbookDay(organizationId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: dsfinvkKeys.cashbook(organizationId ?? '', date),
    queryFn: async () => (await cashbookApi.day(organizationId!, date ? { date } : {})).data,
    enabled: !!organizationId,
    placeholderData: (previous) => previous,
  });
}

export function useCreateCashbookEntry(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCashbookEntryData) => (await cashbookApi.create(organizationId!, data)).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dsfinvkKeys.cashbookAll(organizationId ?? '') });
      void queryClient.invalidateQueries({ queryKey: dsfinvkKeys.all(organizationId ?? '') });
    },
  });
}

// ── Kasse (Geräte-Token) ───────────────────────────────────────────────

/** Kassenbuch dieses Geräts, heute. */
export function useDeviceCashbook(enabled: boolean) {
  return useQuery({
    queryKey: dsfinvkKeys.device,
    queryFn: async () => (await deviceApi.getCashbook()).data,
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useCreateDeviceCashbookEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCashbookEntryData) => (await deviceApi.createCashbookEntry(data)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: dsfinvkKeys.device }),
  });
}
