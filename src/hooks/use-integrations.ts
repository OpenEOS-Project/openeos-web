import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { organizationsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import type { IntegrationId } from '@/types/organization';

/**
 * Fehlertexte der Integrations-Endpunkte. Übersetzt wird zentral über
 * apiErrors (INTEGRATION_DISABLED, SUMUP_INVALID_CREDENTIALS, …).
 *
 * Ältere API-Versionen meldeten abgelehnte SumUp-Zugangsdaten nur als
 * SUMUP_API_ERROR mit der Ursache im Text; die bekommen weiterhin den
 * Hinweis auf die Zugangsdaten.
 */
const SUMUP_AUTH_FAILURE =
  /\b401\b|\b403\b|unauthori[sz]ed|not[_ ]authori[sz]ed|forbidden|invalid[_ ](access[_ ])?token|invalid[_ ](api[_ ])?key|credentials/i;

export function useIntegrationErrorMessage() {
  const t = useTranslations('apiErrors');
  const apiErrorMessage = useApiErrorMessage();
  return (error: unknown, fallback?: string): string => {
    if (
      error instanceof ApiException &&
      error.code === 'SUMUP_API_ERROR' &&
      SUMUP_AUTH_FAILURE.test(error.message)
    ) {
      return t('SUMUP_INVALID_CREDENTIALS');
    }
    return apiErrorMessage(error, fallback);
  };
}

/**
 * Schaltet eine Integration ein oder aus.
 *
 * Die API antwortet mit der ganzen Organisation; die kommt sofort in den
 * Auth-Store, weil Seitenleiste und Konfigurationsseite daran hängen — der
 * neue Eintrag soll ohne Neuladen erscheinen bzw. verschwinden.
 */
export function useSetIntegrationEnabled() {
  const queryClient = useQueryClient();
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const setCurrentOrganization = useAuthStore((state) => state.setCurrentOrganization);
  const organizationId = currentOrganization?.organizationId;

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: IntegrationId; enabled: boolean }) => {
      if (!organizationId) throw new Error('No organization');
      const response = await organizationsApi.setIntegrationEnabled(organizationId, id, enabled);
      return response.data;
    },
    onSuccess: (organization) => {
      // Aktuellen Stand aus dem Store lesen statt aus dem Render-Abschluss:
      // dazwischen kann sich die Organisation geändert haben.
      const { currentOrganization: latest, organizations, setOrganizations } =
        useAuthStore.getState();
      if (latest && latest.organizationId === organization.id) {
        setCurrentOrganization({ ...latest, organization });
      }
      // Auch die Liste für den Organisationswechsel, sonst käme beim
      // Zurückwechseln der alte Schalterstand wieder.
      if (organizations.some((o) => o.organizationId === organization.id)) {
        setOrganizations(
          organizations.map((o) =>
            o.organizationId === organization.id ? { ...o, organization } : o,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
    },
  });
}
