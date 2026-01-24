'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriesApi } from '@/lib/api-client';
import type { Category, CreateCategoryData, UpdateCategoryData } from '@/types/category';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (eventId: string) => [...categoryKeys.lists(), eventId] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (eventId: string, id: string) => [...categoryKeys.details(), eventId, id] as const,
};

export function useCategories(eventId: string) {
  return useQuery({
    queryKey: categoryKeys.list(eventId),
    queryFn: async () => {
      const response = await categoriesApi.list(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
}

export function useCategory(eventId: string, id: string) {
  return useQuery({
    queryKey: categoryKeys.detail(eventId, id),
    queryFn: async () => {
      const response = await categoriesApi.get(eventId, id);
      return response.data;
    },
    enabled: !!eventId && !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: CreateCategoryData;
    }) => {
      const response = await categoriesApi.create(eventId, data);
      return response.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(eventId) });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      id,
      data,
    }: {
      eventId: string;
      id: string;
      data: UpdateCategoryData;
    }) => {
      const response = await categoriesApi.update(eventId, id, data);
      return response.data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(eventId) });
      queryClient.setQueryData(categoryKeys.detail(eventId, data.id), data);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, id }: { eventId: string; id: string }) => {
      await categoriesApi.delete(eventId, id);
      return { eventId, id };
    },
    onSuccess: ({ eventId, id }) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(eventId) });
      queryClient.removeQueries({ queryKey: categoryKeys.detail(eventId, id) });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      items,
    }: {
      eventId: string;
      items: { id: string; sortOrder: number }[];
    }) => {
      await categoriesApi.reorder(eventId, items);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(eventId) });
    },
  });
}
