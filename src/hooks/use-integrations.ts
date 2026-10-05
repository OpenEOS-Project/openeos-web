import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { organizationsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import type { IntegrationId } from '@/types/organization';

/**
 * Übersetzt die Fehler der Integrations-Endpunkte. INTEGRATION_DISABLED
 * kommt von den Endpunkten einer ausgeschalteten Integration (z. B. SumUp),
 * INTEGRATION_NOT_FOUND vom Schalter selbst, wenn die API die Integration
 * (noch) nicht kennt. SUMUP_* kommen von den SumUp-Endpunkten.
 */
const SUMUP_AUTH_FAILURE =
  /\b401\b|\b403\b|unauthori[sz]ed|not[_ ]authori[sz]ed|forbidden|invalid[_ ](access[_ ])?token|invalid[_ ](api[_ ])?key|credentials/i;

export function useIntegrationErrorMessage() {
  const t = useTranslations('integrations.errors');
  return (error: unknown, fallback?: string): string => {
    if (error instanceof ApiException) {
      if (error.code === 'INTEGRATION_DISABLED') return t('disabled');
      if (error.code === 'INTEGRATION_NOT_FOUND') return t('notFound');
      if (error.code === 'SUMUP_NOT_CONFIGURED') return t('sumupNotConfigured');
      // Neuere API-Versionen melden abgelehnte Zugangsdaten (SumUp-401)
      // mit eigenem Code; aeltere nur als SUMUP_API_ERROR (siehe unten).
      if (error.code === 'SUMUP_INVALID_CREDENTIALS') return t('sumupUnauthorized');
      // Die API reicht SumUp-Fehler als 400 SUMUP_API_ERROR durch; die
      // Ursache steht nur im Text (Typ/Detail von SumUp bzw. Status der
      // Upstream-Antwort). Abgelehnte Zugangsdaten sind der haeufigste
      // Fall und bekommen einen eigenen, handlungsleitenden Hinweis.
      if (error.code === 'SUMUP_API_ERROR') {
        return SUMUP_AUTH_FAILURE.test(error.message)
          ? t('sumupUnauthorized')
          : t('sumupApiError');
      }
    }
    return fallback ?? t('generic');
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
