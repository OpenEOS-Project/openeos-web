import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/lib/api-client';

export function useAdminUsers(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const response = await adminApi.listUsers(params);
      return response;
    },
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => adminApi.unlockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdminOrganizations(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin', 'organizations', params],
    queryFn: async () => {
      const response = await adminApi.listOrganizations(params);
      return response;
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const response = await adminApi.getOverviewStats();
      return response.data;
    },
  });
}
