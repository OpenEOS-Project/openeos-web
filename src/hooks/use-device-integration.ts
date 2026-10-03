import { useQuery } from '@tanstack/react-query';

import { isIntegrationEnabled } from '@/config/integrations';
import { deviceApi } from '@/lib/api-client';
import type { IntegrationId } from '@/types/organization';

/**
 * Ist eine Integration für die Organisation des Geräts eingeschaltet?
 *
 * Nutzt dieselbe Abfrage wie die Kassenseite (`['device-organization']`,
 * ganze Antwort im Cache), damit kein zweiter Aufruf entsteht. Solange die
 * Antwort fehlt, gilt die Integration als aus: lieber kurz keine
 * Kartenzahlung anbieten als eine, die die API mit 403 ablehnt.
 */
export function useDeviceIntegrationEnabled(id: IntegrationId): boolean {
  const { data } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  return isIntegrationEnabled(data?.data?.settings, id);
}
