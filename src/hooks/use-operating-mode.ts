'use client';

import { useQuery } from '@tanstack/react-query';

import { deviceApi } from '@/lib/api-client';
import { resolveOperatingMode, type OperatingModeView } from '@/lib/operating-mode';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Betriebsart der aktuellen Organisation (Verwaltung): „Nur Bons“,
 * „Bargeldlos“ oder „Alle Funktionen“ samt Bargeld, Preisen und Bestand.
 * Die Organisation im Store wird nach jedem Wechsel neu geladen.
 */
export function useOperatingMode(): OperatingModeView {
  const organization = useAuthStore((state) => state.currentOrganization?.organization);
  return resolveOperatingMode(organization);
}

/**
 * Dasselbe für die Geräte (Kasse, Kundenanzeige): gleiche Abfrage wie die
 * Kassenseite (`['device-organization']`), die bei
 * `organizationSettingsUpdated` neu lädt — ein Wechsel kommt so ohne
 * Neuladen an. Solange die Antwort fehlt, ist Bargeld aus (lieber kurz kein
 * Bar-Button als einer, den die API ablehnt).
 */
export function useDeviceOperatingMode(): OperatingModeView {
  const { data } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  return resolveOperatingMode(data?.data);
}
