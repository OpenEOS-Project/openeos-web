import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, organizationsApi } from '@/lib/api-client';

export function useMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', organizationId, 'members'],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await organizationsApi.getMembers(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      organizationsApi.updateMemberRole(organizationId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}

export function useInvitations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', organizationId, 'invitations'],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await organizationsApi.getInvitations(organizationId);
      return response;
    },
    enabled: !!organizationId,
  });
}

export function useCreateInvitation(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      organizationsApi.createInvitation(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'invitations'] });
    },
  });
}

export function useDeleteInvitation(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      organizationsApi.deleteInvitation(organizationId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'invitations'] });
    },
  });
}

// User's pending invitations (invitations sent TO the current user)
export function useMyInvitations() {
  return useQuery({
    queryKey: ['auth', 'invitations'],
    queryFn: async () => {
      const response = await authApi.myInvitations();
      return response.data;
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => authApi.acceptInvitation(token),
    onSuccess: () => {
      // Invalidate invitations and user data to refresh organization list
      queryClient.invalidateQueries({ queryKey: ['auth', 'invitations'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => authApi.declineInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'invitations'] });
    },
  });
}
