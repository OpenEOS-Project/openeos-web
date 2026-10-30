'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiTokensApi } from '@/lib/api-client';

import type { ApiToken, CreateApiTokenInput, CreatedApiToken } from '@/types/api-token';

export const apiTokenKeys = {
  list: (organizationId: string | undefined) => ['organizations', organizationId, 'api-tokens'] as const,
};

/**
 * Alle Zugänge der Organisation, auch abgelaufene und widerrufene, neueste
 * zuerst. Nur Admins dürfen die Liste sehen — Mitglieder bekommen 403,
 * deshalb `enabled` nur mit `isAdmin`.
 */
export function useApiTokens(organizationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: apiTokenKeys.list(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await apiTokensApi.list(organizationId);
      return response.data;
    },
    enabled: !!organizationId && enabled,
    staleTime: 15_000,
  });
}

/** Legt einen Zugang an; die Antwort trägt den Klartext genau einmal. */
export function useCreateApiToken(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateApiTokenInput): Promise<CreatedApiToken> => {
      const response = await apiTokensApi.create(organizationId, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list(organizationId) });
    },
  });
}

/** Widerruft einen Zugang; der Eintrag bleibt mit `revokedAt` in der Liste. */
export function useRevokeApiToken(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<ApiToken> => {
      const response = await apiTokensApi.revoke(organizationId, id);
      return response.data;
    },
    onSuccess: (revoked) => {
      queryClient.setQueryData<ApiToken[]>(apiTokenKeys.list(organizationId), (current) =>
        current?.map((token) => (token.id === revoked.id ? revoked : token))
      );
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list(organizationId) });
    },
  });
}
