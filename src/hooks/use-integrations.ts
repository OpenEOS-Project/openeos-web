import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useOrganization } from '@/hooks/use-organizations';
import { organizationsApi } from '@/lib/api-client';
import { isTseComingSoon } from '@/lib/tse';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import type { IntegrationId, Organization } from '@/types/organization';

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
      // Die Antwort trägt dieselben abgeleiteten Felder wie
      // GET /organizations/:id (Betriebsart, tseActive, cashAllowed, tse).
      // Zusammengeführt wird trotzdem: ältere API-Versionen lieferten die
      // nackte Organisation.
      if (latest && latest.organizationId === organization.id) {
        setCurrentOrganization({ ...latest, organization: { ...latest.organization, ...organization } });
      }
      // Auch die Liste für den Organisationswechsel, sonst käme beim
      // Zurückwechseln der alte Schalterstand wieder.
      if (organizations.some((o) => o.organizationId === organization.id)) {
        setOrganizations(
          organizations.map((o) =>
            o.organizationId === organization.id ? { ...o, organization: { ...o.organization, ...organization } } : o,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['sumup-readers', organizationId] });
      // Cloud-TSE: die Voraussetzungen prüft die API erst bei eingeschalteter Integration.
      queryClient.invalidateQueries({ queryKey: ['tse', organizationId] });
    },
  });
}

/**
 * Organisation für Katalog und Integrationsseiten: Schalter aus dem
 * Auth-Store (ändern sich sofort), Land und Cloud-TSE bevorzugt aus
 * GET /organizations/:id (frischer als die Liste beim Anmelden, die seit
 * der API mit einheitlicher Organisations-Antwort `tse` ebenfalls trägt).
 */
export function useIntegrationOrganization(): Partial<Organization> | undefined {
  const stored = useAuthStore((state) => state.currentOrganization?.organization);
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId) ?? '';
  const { data: detail } = useOrganization(organizationId);
  return useMemo(() => {
    if (!stored) return detail;
    return {
      ...stored,
      country: detail?.country ?? stored.country,
      tse: detail?.tse ?? stored.tse,
      tseActive: detail?.tseActive ?? stored.tseActive,
    };
  }, [stored, detail]);
}

/**
 * Cloud-TSE auf diesem Server angekündigt („Bald verfügbar“)? Für Texte,
 * die sonst auf „Cloud-TSE einschalten“ verweisen.
 */
export function useTseComingSoon(): boolean {
  return isTseComingSoon(useIntegrationOrganization()?.tse);
}
