'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { productionStationsApi, ordersApi } from '@/lib/api-client';
import type {
  CreateProductionStationData,
  UpdateProductionStationData,
} from '@/types/production-station';

export const productionStationKeys = {
  all: ['productionStations'] as const,
  lists: () => [...productionStationKeys.all, 'list'] as const,
  list: (eventId: string) => [...productionStationKeys.lists(), eventId] as const,
  details: () => [...productionStationKeys.all, 'detail'] as const,
  detail: (eventId: string, id: string) => [...productionStationKeys.details(), eventId, id] as const,
};

export function useProductionStations(eventId: string) {
  return useQuery({
    queryKey: productionStationKeys.list(eventId),
    queryFn: async () => {
      const response = await productionStationsApi.list(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
}

export function useProductionStation(eventId: string, id: string) {
  return useQuery({
    queryKey: productionStationKeys.detail(eventId, id),
    queryFn: async () => {
      const response = await productionStationsApi.get(eventId, id);
      return response.data;
    },
    enabled: !!eventId && !!id,
  });
}

export function useCreateProductionStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: CreateProductionStationData;
    }) => {
      const response = await productionStationsApi.create(eventId, data);
      return response.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productionStationKeys.list(eventId) });
    },
  });
}

export function useUpdateProductionStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      id,
      data,
    }: {
      eventId: string;
      id: string;
      data: UpdateProductionStationData;
    }) => {
      const response = await productionStationsApi.update(eventId, id, data);
      return response.data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productionStationKeys.list(eventId) });
      queryClient.setQueryData(productionStationKeys.detail(eventId, data.id), data);
    },
  });
}

export function useDeleteProductionStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, id }: { eventId: string; id: string }) => {
      await productionStationsApi.delete(eventId, id);
      return { eventId, id };
    },
    onSuccess: ({ eventId, id }) => {
      queryClient.invalidateQueries({ queryKey: productionStationKeys.list(eventId) });
      queryClient.removeQueries({ queryKey: productionStationKeys.detail(eventId, id) });
    },
  });
}

export function useProductionStationsLive(eventId: string) {
  return useQuery({
    queryKey: [...productionStationKeys.list(eventId), 'live'],
    queryFn: async () => {
      const response = await productionStationsApi.getLive(eventId);
      return response.data;
    },
    enabled: !!eventId,
    refetchInterval: 10000,
  });
}

export function useMarkStationItemReady(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      orderId,
      itemId,
    }: {
      organizationId: string;
      orderId: string;
      itemId: string;
    }) => {
      const response = await ordersApi.markItemReady(organizationId, orderId, itemId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...productionStationKeys.list(eventId), 'live'],
      });
    },
  });
}
