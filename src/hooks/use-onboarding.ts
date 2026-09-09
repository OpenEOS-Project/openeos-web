'use client';

import { useQuery } from '@tanstack/react-query';

import { onboardingApi } from '@/lib/api-client';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  status: (organizationId: string) => [...onboardingKeys.all, 'status', organizationId] as const,
};

/**
 * Fortschritt der Ersteinrichtung.
 *
 * Der Server leitet ihn aus den echten Daten ab, deshalb muss nach dem
 * Anlegen einer Kategorie oder eines Produkts nur diese Abfrage
 * ungültig werden — es gibt keinen zweiten Zustand, der nachzuziehen wäre.
 */
export function useOnboardingStatus(organizationId: string) {
  return useQuery({
    queryKey: onboardingKeys.status(organizationId),
    queryFn: async () => {
      const response = await onboardingApi.status(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    /* Bei jedem Betreten des Dashboards frisch holen. Global stehen
       60 Sekunden, und genau in dieser Minute spielt sich das Einrichten
       ab: Produkt anlegen, zurueck aufs Dashboard, Haken erwarten. Mit
       dem Standardwert bliebe der Schritt offen, obwohl er erledigt ist.

       Die Alternative waere, den Schluessel in jeder betroffenen Mutation
       mit ungueltig zu machen — fuenf Stellen, und die sechste vergisst
       man. Eine Zaehlabfrage beim Seitenaufruf ist billiger als diese
       Streuung, und die Karte verschwindet ohnehin, sobald alles steht. */
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
