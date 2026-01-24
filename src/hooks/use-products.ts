'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { productsApi } from '@/lib/api-client';
import type { CreateProductData, Product, UpdateProductData } from '@/types/product';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (eventId: string, params?: { categoryId?: string; isActive?: boolean }) =>
    [...productKeys.lists(), eventId, params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (eventId: string, id: string) => [...productKeys.details(), eventId, id] as const,
};

export function useProducts(
  eventId: string,
  params?: { categoryId?: string; isActive?: boolean }
) {
  return useQuery({
    queryKey: productKeys.list(eventId, params),
    queryFn: async () => {
      const response = await productsApi.list(eventId, params);
      return response.data;
    },
    enabled: !!eventId,
  });
}

export function useProduct(eventId: string, id: string) {
  return useQuery({
    queryKey: productKeys.detail(eventId, id),
    queryFn: async () => {
      const response = await productsApi.get(eventId, id);
      return response.data;
    },
    enabled: !!eventId && !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: CreateProductData;
    }) => {
      const response = await productsApi.create(eventId, data);
      return response.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      id,
      data,
    }: {
      eventId: string;
      id: string;
      data: UpdateProductData;
    }) => {
      const response = await productsApi.update(eventId, id, data);
      return response.data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.setQueryData(productKeys.detail(eventId, data.id), data);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, id }: { eventId: string; id: string }) => {
      await productsApi.delete(eventId, id);
      return { eventId, id };
    },
    onSuccess: ({ eventId, id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.removeQueries({ queryKey: productKeys.detail(eventId, id) });
    },
  });
}

export function useUpdateProductStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      id,
      quantity,
      reason,
    }: {
      eventId: string;
      id: string;
      quantity: number;
      reason?: string;
    }) => {
      await productsApi.updateStock(eventId, id, quantity, reason);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

export function useReorderProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      items,
    }: {
      eventId: string;
      items: { id: string; sortOrder: number }[];
    }) => {
      await productsApi.reorder(eventId, items);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
