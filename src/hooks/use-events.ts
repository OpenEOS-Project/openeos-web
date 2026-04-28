'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { eventsApi } from '@/lib/api-client';
import type { CreateEventData, Event, UpdateEventData } from '@/types/event';

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (organizationId: string) => [...eventKeys.lists(), organizationId] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (organizationId: string, id: string) => [...eventKeys.details(), organizationId, id] as const,
};

export function useEvents(organizationId: string) {
  return useQuery({
    queryKey: eventKeys.list(organizationId),
    queryFn: async () => {
      const response = await eventsApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useEvent(organizationId: string, id: string) {
  return useQuery({
    queryKey: eventKeys.detail(organizationId, id),
    queryFn: async () => {
      const response = await eventsApi.get(organizationId, id);
      return response.data;
    },
    enabled: !!organizationId && !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, data }: { organizationId: string; data: CreateEventData }) => {
      const response = await eventsApi.create(organizationId, data);
      return response.data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      id,
      data,
    }: {
      organizationId: string;
      id: string;
      data: UpdateEventData;
    }) => {
      const response = await eventsApi.update(organizationId, id, data);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      await eventsApi.delete(organizationId, id);
      return { organizationId, id };
    },
    onSuccess: ({ organizationId, id }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.removeQueries({ queryKey: eventKeys.detail(organizationId, id) });
    },
  });
}

export function useActivateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.activate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeactivateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.deactivate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useSetTestMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await eventsApi.setTestMode(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.list(organizationId) });
      queryClient.setQueryData(eventKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useCopyProductsFromEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      targetEventId,
      sourceEventId,
      options,
    }: {
      organizationId: string;
      targetEventId: string;
      sourceEventId: string;
      options?: { categoryIds?: string[]; productIds?: string[]; copyStock?: boolean };
    }) => {
      const response = await eventsApi.copyProductsFrom(organizationId, targetEventId, sourceEventId, options);
      return response.data;
    },
    onSuccess: (_, { targetEventId }) => {
      // Invalidate categories and products for the target event
      queryClient.invalidateQueries({ queryKey: ['categories', 'list', targetEventId] });
      queryClient.invalidateQueries({ queryKey: ['products', 'list', targetEventId] });
    },
  });
}
