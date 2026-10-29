'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assistantApi } from '@/lib/api-client';
import { assistantUsable } from '@/lib/assistant';

import type { AssistantStatus } from '@/types/assistant';

export const assistantKeys = {
  status: (organizationId: string | undefined) =>
    ['organizations', organizationId, 'assistant'] as const,
};

/**
 * Status der Assistent-Funktionen: Opt-in, Verfügbarkeit auf dem Server und
 * die Tageskontingente. Ein Fehler (ältere API ohne den Endpunkt) zählt als
 * „nicht verfügbar“ — deshalb kein Wiederholen und kein Lärm.
 */
export function useAssistantStatus(organizationId: string | undefined) {
  return useQuery({
    queryKey: assistantKeys.status(organizationId),
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID required');
      const response = await assistantApi.status(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    retry: false,
    staleTime: 30_000,
  });
}

/** `true`, sobald Import-Knopf und Icon-Vorschlag erscheinen dürfen. */
export function useAssistantUsable(organizationId: string | undefined): boolean {
  const { data } = useAssistantStatus(organizationId);
  return assistantUsable(data);
}

export function useSetAssistantEnabled(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await assistantApi.setEnabled(organizationId, enabled);
      return response.data;
    },
    onSuccess: (status: AssistantStatus) => {
      queryClient.setQueryData(assistantKeys.status(organizationId), status);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

/** Icon-Vorschläge für Produktnamen (bis 100 je Aufruf). */
export function useIconSuggestions(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (names: string[]) => {
      const response = await assistantApi.iconSuggestions(organizationId, names);
      return response.data;
    },
    onSettled: () => {
      // Stufe 2 verbraucht Kontingent — die Anzeige in den Einstellungen nachziehen.
      queryClient.invalidateQueries({ queryKey: assistantKeys.status(organizationId) });
    },
  });
}
