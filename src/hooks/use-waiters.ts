import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { waitersApi } from '@/lib/api-client';
import type { BulkCreateWaitersData, CreateWaiterData, SettleWaiterData, UpdateWaiterData } from '@/types/waiter';

const key = (organizationId: string) => ['organizations', organizationId, 'waiters'] as const;

/** Bedienungen der Organisation (ohne PIN), optional je Veranstaltung. */
export function useWaiters(organizationId: string | undefined, eventId?: string | null) {
  return useQuery({
    queryKey: [...key(organizationId ?? ''), eventId ?? 'all'],
    queryFn: async () => waitersApi.list(organizationId!, eventId ? { eventId } : undefined),
    enabled: !!organizationId,
  });
}

function useInvalidate(organizationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: key(organizationId) });
}

export function useCreateWaiter(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: async (data: CreateWaiterData) => (await waitersApi.create(organizationId, data)).data,
    onSuccess: invalidate,
  });
}

export function useBulkCreateWaiters(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: async (data: BulkCreateWaitersData) => (await waitersApi.bulkCreate(organizationId, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateWaiter(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWaiterData }) =>
      (await waitersApi.update(organizationId, id, data)).data,
    onSuccess: invalidate,
  });
}

export function useResetWaiterPin(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin?: string }) =>
      (await waitersApi.resetPin(organizationId, id, pin)).data,
    onSuccess: invalidate,
  });
}

export function useRemoveWaiter(organizationId: string) {
  const invalidate = useInvalidate(organizationId);
  return useMutation({
    mutationFn: async (id: string) => (await waitersApi.remove(organizationId, id)).data,
    onSuccess: invalidate,
  });
}

// ------------------------------------------------------------ Abrechnung

const settlementsKey = (organizationId: string) => ['organizations', organizationId, 'waiter-settlements'] as const;

/** Zwischenstand einer Bedienung (Verwaltung). */
export function useWaiterSummary(organizationId: string, waiterId: string | null, eventId?: string) {
  return useQuery({
    queryKey: [...key(organizationId), 'summary', waiterId, eventId ?? 'current'],
    queryFn: async () => (await waitersApi.summary(organizationId, waiterId!, eventId)).data,
    enabled: !!organizationId && !!waiterId,
    retry: false,
  });
}

export function useWaiterSettlements(organizationId: string | undefined, params?: { eventId?: string; waiterId?: string }) {
  return useQuery({
    queryKey: [...settlementsKey(organizationId ?? ''), params?.eventId ?? 'all', params?.waiterId ?? 'all'],
    queryFn: async () => (await waitersApi.settlements(organizationId!, params)).data,
    enabled: !!organizationId,
  });
}

export function useSettleWaiter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ waiterId, data }: { waiterId: string; data: SettleWaiterData }) =>
      waitersApi.settle(organizationId, waiterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settlementsKey(organizationId) });
      void queryClient.invalidateQueries({ queryKey: key(organizationId) });
    },
  });
}

export function useTransferWaiterTables(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ waiterId, toWaiterId, eventId }: { waiterId: string; toWaiterId: string; eventId?: string }) =>
      (await waitersApi.transferTables(organizationId, waiterId, toWaiterId, eventId)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(organizationId) }),
  });
}

export function useReprintSettlement(organizationId: string) {
  return useMutation({
    mutationFn: async ({ settlementId, printerId }: { settlementId: string; printerId?: string }) =>
      (await waitersApi.reprintSettlement(organizationId, settlementId, printerId)).data,
  });
}
