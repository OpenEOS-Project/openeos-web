import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDeployment } from '@/components/providers/setup-provider';
import { isIntegrationEnabled } from '@/config/integrations';
import { useEvents } from '@/hooks/use-events';
import { useIntegrationOrganization } from '@/hooks/use-integrations';
import { missingMasterData } from '@/lib/dsfinvk';
import {
  isTseComingSoon,
  tseEventCheckFromEligibility,
  tseEventCheckFromEvents,
  tseMasterDataMissingFromEligibility,
  tseRequirements,
  tseSetupStepFrom,
  tseUnlockCandidate,
  type TseSetupInput,
} from '@/lib/tse';

import { useRefreshCurrentOrganization } from '@/components/shared/operating-mode-notices';
import { tseApi } from '@/lib/api-client';
import type { TseStatus, TseTransactionStatus } from '@/types/tse';

/** Abfrageschlüssel der Cloud-TSE je Organisation. */
export const tseKeys = {
  all: (organizationId: string) => ['tse', organizationId] as const,
  status: (organizationId: string) => ['tse', organizationId, 'status'] as const,
  transactions: (organizationId: string, status: TseTransactionStatus | 'all', page: number) =>
    ['tse', organizationId, 'transactions', status, page] as const,
  outages: (organizationId: string) => ['tse', organizationId, 'outages'] as const,
  exports: (organizationId: string) => ['tse', organizationId, 'exports'] as const,
  order: (organizationId: string, orderId: string) => ['tse', organizationId, 'order', orderId] as const,
};

/** Solange die TSE angelegt wird, fragt die Seite alle 3 s nach. */
const CREATING_POLL_MS = 3_000;
/** Sonst genügt eine Minute — die Live-Werte cached die API ohnehin 60 s. */
const IDLE_POLL_MS = 60_000;

export function useTseStatus(organizationId: string | undefined) {
  return useQuery({
    queryKey: tseKeys.status(organizationId ?? ''),
    queryFn: async () => (await tseApi.status(organizationId!)).data,
    enabled: !!organizationId,
    refetchInterval: (query) => {
      const data = query.state.data as TseStatus | undefined;
      return data?.unit?.state === 'creating' ? CREATING_POLL_MS : IDLE_POLL_MS;
    },
  });
}

export const TSE_TRANSACTIONS_PAGE_SIZE = 20;

export function useTseTransactions(
  organizationId: string | undefined,
  status: TseTransactionStatus | 'all',
  page: number,
  enabled = true,
) {
  return useQuery({
    queryKey: tseKeys.transactions(organizationId ?? '', status, page),
    queryFn: async () =>
      (
        await tseApi.transactions(organizationId!, {
          status: status === 'all' ? undefined : status,
          limit: TSE_TRANSACTIONS_PAGE_SIZE,
          offset: page * TSE_TRANSACTIONS_PAGE_SIZE,
        })
      ).data,
    enabled: !!organizationId && enabled,
    placeholderData: (previous) => previous,
  });
}

export function useTseOutages(organizationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: tseKeys.outages(organizationId ?? ''),
    queryFn: async () => (await tseApi.outages(organizationId!)).data,
    enabled: !!organizationId && enabled,
  });
}

export function useTseExports(organizationId: string | undefined, enabled = true, polling = false) {
  return useQuery({
    queryKey: tseKeys.exports(organizationId ?? ''),
    queryFn: async () => (await tseApi.listExports(organizationId!)).data,
    enabled: !!organizationId && enabled,
    refetchInterval: polling ? 5_000 : false,
  });
}

/** TSE-Vorgänge einer Bestellung (nur Admins; ohne TSE leer). */
export function useOrderTse(organizationId: string | undefined, orderId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: tseKeys.order(organizationId ?? '', orderId ?? ''),
    queryFn: async () => (await tseApi.forOrder(organizationId!, orderId!)).data,
    enabled: !!organizationId && !!orderId && enabled,
    retry: false,
  });
}

/**
 * Anlegen (auch durch den Support mit Grund). Danach Status und
 * Organisation neu laden — mit der aktiven TSE wird Bargeld frei.
 */
export function useCreateTse(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { override?: boolean; reason?: string } = {}) =>
      (await tseApi.create(organizationId!, body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tseKeys.all(organizationId ?? '') }),
  });
}

/**
 * Endgültig deaktivieren. Die API schaltet die Integration danach selbst
 * aus; die neu geladene Organisation lässt den Guard in den Katalog
 * zurückleiten.
 */
export function useDeactivateTse(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const refreshOrganization = useRefreshCurrentOrganization();
  return useMutation({
    mutationFn: async (reason?: string) => (await tseApi.deactivate(organizationId!, reason)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tseKeys.all(organizationId ?? '') });
      await queryClient.invalidateQueries({ queryKey: ['operating-mode', organizationId] });
      await refreshOrganization();
    },
  });
}

export function useRequestTseExport(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await tseApi.requestExport(organizationId!)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tseKeys.exports(organizationId ?? '') }),
  });
}

/**
 * Wo steht die Cloud-TSE und woran hängt sie? Für Katalog, Seite und
 * Betriebsart. GET …/tse prüft Veranstaltung und Monat nur bei
 * eingeschalteter Integration in Deutschland; sonst rechnet der Haken aus
 * der Veranstaltungsliste nach (gleiche Regel wie die API).
 */
export function useTseSetup(organizationId: string | undefined) {
  const status = useTseStatus(organizationId);
  const organization = useIntegrationOrganization();
  const events = useEvents(organizationId ?? '');
  const selfHosted = useDeployment().mode === 'selfhosted';

  return useMemo(() => {
    const data = status.data;
    // Der Schalter ändert sich im Store sofort, GET …/tse erst beim nächsten Abruf.
    const enabled = isIntegrationEnabled(organization?.settings, 'tse');
    const fromApiState = !!data && data.integrationEnabled === enabled;
    const fromApi = fromApiState ? tseEventCheckFromEligibility(data.eligibility) : undefined;
    const eventCheck =
      fromApi ?? (events.data ? tseEventCheckFromEvents(events.data, { selfHosted }) : undefined);
    const input: TseSetupInput = {
      available: data ? data.available : organization?.tse?.available !== false,
      comingSoon: data ? isTseComingSoon(data) : isTseComingSoon(organization?.tse),
      integrationEnabled: enabled,
      country: data?.country ?? organization?.country,
      events: eventCheck,
      // Stammdaten prüft die API erst bei eingeschalteter Integration; sonst
      // dieselbe Regel aus den Einstellungen.
      masterDataMissing:
        (fromApiState ? tseMasterDataMissingFromEligibility(data?.eligibility) : undefined) ??
        missingMasterData(organization?.settings),
      unitState: data ? data.unit?.state : organization?.tse?.state,
    };
    const step = tseSetupStepFrom(input);
    return {
      status,
      input,
      step,
      requirements: step ? tseRequirements(input, step) : [],
      eventCheck,
      /** Ziel für „Veranstaltung freischalten“ (nur mit Abrechnung). */
      unlockEvent: !selfHosted && events.data ? tseUnlockCandidate(events.data) : null,
      selfHosted,
    };
  }, [status, organization, events.data, selfHosted]);
}
