import { useQuery } from '@tanstack/react-query';

import { isIntegrationEnabled } from '@/config/integrations';
import { deviceApi } from '@/lib/api-client';
import { isCashBlocked, offersCloseWithoutPayment } from '@/lib/cash-policy';
import { isOrderOnlyMode } from '@/lib/operating-mode';
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

/**
 * Ist Bargeld an dieser Kasse gesperrt? Bargeldloser Modus der Organisation
 * oder „Deutschland ohne Bargeld“ (Landesregel) — gleiche Abfrage wie oben.
 * Die Kasse lädt sie bei `organizationSettingsUpdated` neu und stellt sich
 * so ohne Neuladen um. Solange die Antwort fehlt, gilt Bargeld als erlaubt
 * (Standard); die API weist es, wo gesperrt, ohnehin ab.
 */
export function useDeviceCashlessMode(): boolean {
  const { data } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  return isCashBlocked(data?.data);
}

/**
 * „Ohne Zahlung abschließen“ an der Kasse anbieten? Nur bei „Deutschland
 * ohne Bargeld“: Bargeld läuft dann außerhalb von OpenEOS (offene
 * Ladenkasse), die Bestellung wird ohne Zahlung abgeschlossen.
 */
export function useDeviceCloseWithoutPayment(): boolean {
  const { data } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  return offersCloseWithoutPayment(data?.data);
}

/**
 * Betriebsmodus „Nur Bestellen“ der Organisation des Geräts — gleiche
 * Abfrage. Ohne Antwort gilt der Kassenbetrieb; die API sperrt Zahlungen im
 * Modus „Nur Bestellen“ ohnehin (403 ORDER_ONLY_MODE).
 */
export function useDeviceOrderOnlyMode(): boolean {
  const { data } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  return isOrderOnlyMode(data?.data?.settings);
}
