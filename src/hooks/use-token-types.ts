'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reportKeys } from '@/hooks/use-reports';
import { tokensApi } from '@/lib/api-client';
import type { TokenTypeInput } from '@/types/token';

/** Wertmarken in der Verwaltung: Markentypen, Auswertung und Vorgänge. */
const keys = {
  types: (organizationId: string | undefined) => ['organizations', organizationId, 'token-types'] as const,
  transactions: (organizationId: string | undefined, params: object) =>
    ['organizations', organizationId, 'token-transactions', params] as const,
};

export interface TokenReportQuery {
  eventId?: string;
  startDate?: string;
  endDate?: string;
}

export function useTokenTypes(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.types(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      return (await tokensApi.listTypes(organizationId)).data;
    },
    enabled: !!organizationId,
  });
}

function useInvalidateTokenTypes(organizationId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: keys.types(organizationId) });
    queryClient.invalidateQueries({ queryKey: [...reportKeys.all, organizationId, 'tokens'] });
  };
}

export function useCreateTokenType(organizationId: string) {
  const invalidate = useInvalidateTokenTypes(organizationId);
  return useMutation({
    mutationFn: (data: TokenTypeInput) => tokensApi.createType(organizationId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateTokenType(organizationId: string) {
  const invalidate = useInvalidateTokenTypes(organizationId);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TokenTypeInput }) => tokensApi.updateType(organizationId, id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTokenType(organizationId: string) {
  const invalidate = useInvalidateTokenTypes(organizationId);
  return useMutation({
    mutationFn: (id: string) => tokensApi.deleteType(organizationId, id),
    onSuccess: invalidate,
  });
}

/** Auswertung (verkauft, eingelöst, zurückgegeben, Rücktausch, im Umlauf). */
export function useTokenReport(organizationId: string, params: TokenReportQuery, enabled = true) {
  return useQuery({
    queryKey: [...reportKeys.all, organizationId, 'tokens', params] as const,
    queryFn: async () => (await tokensApi.report(organizationId, params)).data,
    enabled: !!organizationId && enabled,
  });
}

/** Letzte Verkäufe und Rücktausche (neueste zuerst). */
export function useTokenTransactions(
  organizationId: string,
  params: TokenReportQuery & { kind?: 'sale' | 'buyback'; limit?: number },
) {
  return useQuery({
    queryKey: keys.transactions(organizationId, params),
    queryFn: async () => (await tokensApi.transactions(organizationId, params)).data,
    enabled: !!organizationId,
  });
}
