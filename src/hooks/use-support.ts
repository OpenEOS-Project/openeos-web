'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, supportApi } from '@/lib/api-client';

const POLL_INTERVAL = 5000;

const keys = {
  org: (organizationId: string | undefined) => ['organizations', organizationId, 'support'] as const,
  adminThreads: () => ['admin', 'support', 'threads'] as const,
  adminMessages: (organizationId: string | undefined) => ['admin', 'support', organizationId, 'messages'] as const,
};

/** Organization member view: own support thread with OpenEOS. */
export function useSupportThread(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.org(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await supportApi.get(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useSendSupportMessage(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!organizationId) throw new Error('Organization ID required');
      return supportApi.sendMessage(organizationId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.org(organizationId) });
    },
  });
}

/** Super-Admin view: all organization threads, sorted by the API. */
export function useAdminSupportThreads() {
  return useQuery({
    queryKey: keys.adminThreads(),
    queryFn: async () => {
      const response = await adminApi.getSupportThreads();
      return response.data;
    },
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAdminSupportMessages(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.adminMessages(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await adminApi.getSupportMessages(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAdminSendSupportMessage(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!organizationId) throw new Error('Organization ID required');
      return adminApi.sendSupportMessage(organizationId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.adminMessages(organizationId) });
      queryClient.invalidateQueries({ queryKey: keys.adminThreads() });
    },
  });
}
