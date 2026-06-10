import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pfandTypesApi } from '@/lib/api-client';
import type { CreatePfandTypeData, UpdatePfandTypeData } from '@/types/pfand';

const keys = {
  list: (organizationId: string | undefined) =>
    ['organizations', organizationId, 'pfand-types'] as const,
};

export function usePfandTypes(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.list(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await pfandTypesApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}

export function useCreatePfandType(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePfandTypeData) => pfandTypesApi.create(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}

export function useUpdatePfandType(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePfandTypeData }) =>
      pfandTypesApi.update(organizationId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}

export function useDeletePfandType(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pfandTypesApi.delete(organizationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(organizationId) });
    },
  });
}
