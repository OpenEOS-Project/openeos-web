'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { organizationsApi, adminApi } from '@/lib/api-client';
import type { CreateOrganizationData, Organization, UpdateOrganizationData } from '@/types/organization';

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: () => [...organizationKeys.lists()] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
  members: (id: string) => [...organizationKeys.all, id, 'members'] as const,
  invitations: (id: string) => [...organizationKeys.all, id, 'invitations'] as const,
};

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: async () => {
      const response = await organizationsApi.list();
      return response.data;
    },
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: async () => {
      const response = await organizationsApi.get(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrganizationData) => {
      const response = await organizationsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOrganizationData }) => {
      const response = await organizationsApi.update(id, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.setQueryData(organizationKeys.detail(data.id), data);
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await organizationsApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      queryClient.removeQueries({ queryKey: organizationKeys.detail(id) });
    },
  });
}

export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.members(orgId),
    queryFn: async () => {
      const response = await organizationsApi.getMembers(orgId);
      return response.data;
    },
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, email, role }: { orgId: string; email: string; role: string }) => {
      await organizationsApi.createInvitation(orgId, { email, role });
    },
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgId) });
    },
  });
}

// Admin hooks for super-admin view
export const adminOrganizationKeys = {
  all: ['admin-organizations'] as const,
  lists: () => [...adminOrganizationKeys.all, 'list'] as const,
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    [...adminOrganizationKeys.lists(), params] as const,
};

export function useAdminOrganizations(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: adminOrganizationKeys.list(params),
    queryFn: async () => {
      const response = await adminApi.listOrganizations(params);
      return {
        data: response.data,
        meta: response.meta,
      };
    },
  });
}
