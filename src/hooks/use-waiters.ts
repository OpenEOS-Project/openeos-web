import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { waitersApi } from '@/lib/api-client';
import type {
  BulkCreateWaitersData,
  CreateWaiterData,
  SettleWaiterData,
  TipPayoutData,
  UpdateWaiterData,
} from '@/types/waiter';

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

// ------------------------------------------------ Live-Kassensturz, Trinkgeld

const liveKey = (organizationId: string) => [...settlementsKey(organizationId), 'live'] as const;

/** Live-Kassensturz (Soll je Bedienung seit der letzten Abrechnung). */
export function useLiveCashAudit(organizationId: string | undefined, eventId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [...liveKey(organizationId ?? ''), eventId ?? 'current'],
    queryFn: async () => (await waitersApi.liveCashAudit(organizationId!, eventId ?? undefined)).data,
    enabled: !!organizationId && enabled,
    retry: false,
  });
}

/** Kartentrinkgeld einer Bedienung (Arbeitnehmer?, offen, Auszahlungen). */
export function useTipPayoutStatus(organizationId: string, waiterId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...key(organizationId), 'tip-payouts', waiterId],
    queryFn: async () => (await waitersApi.tipPayouts(organizationId, waiterId!)).data,
    enabled: !!organizationId && !!waiterId && enabled,
    retry: false,
  });
}

export function usePayOutTips(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ waiterId, data }: { waiterId: string; data: TipPayoutData }) =>
      waitersApi.payOutTips(organizationId, waiterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settlementsKey(organizationId) });
      void queryClient.invalidateQueries({ queryKey: key(organizationId) });
    },
  });
}
