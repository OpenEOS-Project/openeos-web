'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { inventoryApi } from '@/lib/api-client';
import type {
  BulkAddInventoryItemsData,
  CreateInventoryCountData,
  QueryInventoryCountsParams,
  UpdateInventoryCountData,
  UpdateInventoryItemData,
} from '@/types/inventory';

export const inventoryKeys = {
  all: ['inventory'] as const,
  counts: (eventId: string) => [...inventoryKeys.all, 'counts', eventId] as const,
  count: (eventId: string, countId: string) =>
    [...inventoryKeys.all, 'count', eventId, countId] as const,
};

export function useInventoryCounts(eventId: string, params?: QueryInventoryCountsParams) {
  return useQuery({
    queryKey: [...inventoryKeys.counts(eventId), params ?? {}],
    queryFn: async () => (await inventoryApi.listCounts(eventId, params)).data,
    enabled: !!eventId,
  });
}

export function useInventoryCount(eventId: string, countId: string) {
  return useQuery({
    queryKey: inventoryKeys.count(eventId, countId),
    queryFn: async () => (await inventoryApi.getCount(eventId, countId)).data,
    enabled: !!eventId && !!countId,
  });
}

function useInvalidate(eventId: string) {
  const queryClient = useQueryClient();
  return (countId?: string) => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.counts(eventId) });
    if (countId) {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.count(eventId, countId) });
    }
  };
}

export function useCreateInventoryCount(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async (data: CreateInventoryCountData) =>
      (await inventoryApi.createCount(eventId, data)).data,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateInventoryCount(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async ({ countId, data }: { countId: string; data: UpdateInventoryCountData }) =>
      (await inventoryApi.updateCount(eventId, countId, data)).data,
    onSuccess: (_data, { countId }) => invalidate(countId),
  });
}

export function useDeleteInventoryCount(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async (countId: string) => inventoryApi.deleteCount(eventId, countId),
    onSuccess: () => invalidate(),
  });
}

export function useStartInventoryCount(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async (countId: string) => (await inventoryApi.startCount(eventId, countId)).data,
    onSuccess: (_data, countId) => invalidate(countId),
  });
}

export function useCompleteInventoryCount(eventId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async (countId: string) =>
      (await inventoryApi.completeCount(eventId, countId)).data,
    onSuccess: (_data, countId) => {
      invalidate(countId);
      // Completing applies stock corrections — product lists are stale now.
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useCancelInventoryCount(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async (countId: string) => (await inventoryApi.cancelCount(eventId, countId)).data,
    onSuccess: (_data, countId) => invalidate(countId),
  });
}

export function useBulkAddInventoryItems(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async ({ countId, data }: { countId: string; data: BulkAddInventoryItemsData }) =>
      (await inventoryApi.bulkAddItems(eventId, countId, data)).data,
    onSuccess: (_data, { countId }) => invalidate(countId),
  });
}

export function useUpdateInventoryItem(eventId: string) {
  const invalidate = useInvalidate(eventId);
  return useMutation({
    mutationFn: async ({
      countId,
      itemId,
      data,
    }: {
      countId: string;
      itemId: string;
      data: UpdateInventoryItemData;
    }) => (await inventoryApi.updateItem(eventId, countId, itemId, data)).data,
    onSuccess: (_data, { countId }) => invalidate(countId),
  });
}
