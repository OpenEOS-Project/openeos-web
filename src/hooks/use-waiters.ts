import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { waitersApi } from '@/lib/api-client';
import type { BulkCreateWaitersData, CreateWaiterData, UpdateWaiterData } from '@/types/waiter';

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
