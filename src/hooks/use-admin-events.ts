'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-client';

interface AdminEventsParams {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  invoiced?: boolean;
  page?: number;
  limit?: number;
}

export function useAdminEvents(params?: AdminEventsParams) {
  return useQuery({
    queryKey: ['admin', 'events', params],
    queryFn: async () => {
      const response = await adminApi.listAdminEvents(params);
      return response;
    },
  });
}

export function useAdminEvent(eventId: string) {
  return useQuery({
    queryKey: ['admin', 'events', eventId],
    queryFn: async () => {
      const response = await adminApi.getAdminEvent(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
}

export function useMarkEventInvoiced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.markEventInvoiced(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useUnmarkEventInvoiced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminApi.unmarkEventInvoiced(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}
