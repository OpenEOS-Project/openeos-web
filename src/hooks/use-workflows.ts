'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workflowsApi } from '@/lib/api-client';
import type { CreateWorkflowData, UpdateWorkflowData, Workflow } from '@/types/workflow';

export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (organizationId: string) => [...workflowKeys.lists(), organizationId] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (organizationId: string, id: string) => [...workflowKeys.details(), organizationId, id] as const,
  runs: (organizationId: string, id: string) => [...workflowKeys.all, 'runs', organizationId, id] as const,
};

export function useWorkflows(organizationId: string) {
  return useQuery({
    queryKey: workflowKeys.list(organizationId),
    queryFn: async () => {
      const response = await workflowsApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useWorkflow(organizationId: string, id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(organizationId, id),
    queryFn: async () => {
      const response = await workflowsApi.get(organizationId, id);
      return response.data;
    },
    enabled: !!organizationId && !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: CreateWorkflowData;
    }) => {
      const response = await workflowsApi.create(organizationId, data);
      return response.data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(organizationId) });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      id,
      data,
    }: {
      organizationId: string;
      id: string;
      data: UpdateWorkflowData;
    }) => {
      const response = await workflowsApi.update(organizationId, id, data);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(organizationId) });
      queryClient.setQueryData(workflowKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      await workflowsApi.delete(organizationId, id);
      return { organizationId, id };
    },
    onSuccess: ({ organizationId, id }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(organizationId) });
      queryClient.removeQueries({ queryKey: workflowKeys.detail(organizationId, id) });
    },
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await workflowsApi.activate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(organizationId) });
      queryClient.setQueryData(workflowKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useDeactivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, id }: { organizationId: string; id: string }) => {
      const response = await workflowsApi.deactivate(organizationId, id);
      return response.data;
    },
    onSuccess: (data, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.list(organizationId) });
      queryClient.setQueryData(workflowKeys.detail(organizationId, data.id), data);
    },
  });
}

export function useTestWorkflow() {
  return useMutation({
    mutationFn: async ({
      organizationId,
      id,
      testData,
    }: {
      organizationId: string;
      id: string;
      testData?: Record<string, unknown>;
    }) => {
      const response = await workflowsApi.test(organizationId, id, testData);
      return response.data;
    },
  });
}

export function useWorkflowRuns(organizationId: string, workflowId: string) {
  return useQuery({
    queryKey: workflowKeys.runs(organizationId, workflowId),
    queryFn: async () => {
      const response = await workflowsApi.getRuns(organizationId, workflowId);
      return response.data;
    },
    enabled: !!organizationId && !!workflowId,
  });
}
