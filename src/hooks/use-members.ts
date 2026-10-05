import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, organizationsApi } from '@/lib/api-client';
import { useDeployment } from '@/components/providers/setup-provider';
import { useAuthStore } from '@/stores/auth-store';
import type { AddMemberData, OrganizationPermissions } from '@/types/auth';

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
    // Id der Mitgliedschaft (UserOrganization.id), nicht die des Benutzers
    mutationFn: (memberId: string) => organizationsApi.removeMember(organizationId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}

export function useUpdateMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role, permissions }: { userId: string; role?: string; permissions?: OrganizationPermissions }) =>
      organizationsApi.updateMember(organizationId, userId, { role, permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}

/**
 * Darf der angemeldete Benutzer Konten direkt (mit Startpasswort) anlegen?
 * Die API erlaubt das nur in einer eigenstaendigen Installation und nur Admins.
 */
export function useCanCreateMemberAccount(): boolean {
  const deployment = useDeployment();
  const { currentOrganization, user } = useAuthStore();
  const isAdmin = !!user?.isSuperAdmin || currentOrganization?.role === 'admin';
  return deployment.mode === 'selfhosted' && isAdmin;
}

export function useAddMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddMemberData) => organizationsApi.addMember(organizationId, data),
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
    mutationFn: (data: { email: string; role: string; permissions?: OrganizationPermissions }) =>
      organizationsApi.createInvitation(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'invitations'] });
    },
  });
}

export function useResendInvitation(organizationId: string) {
  return useMutation({
    mutationFn: (invitationId: string) =>
      organizationsApi.resendInvitation(organizationId, invitationId),
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

export function useSetMemberPin(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, pin }: { userId: string; pin: string }) =>
      organizationsApi.setMemberPin(organizationId, userId, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}

export function useRemoveMemberPin(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      organizationsApi.removeMemberPin(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'members'] });
    },
  });
}
