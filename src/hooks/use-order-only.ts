'use client';

import { isOrderOnlyMode } from '@/lib/operating-mode';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Nutzt die aktuelle Organisation den Modus „Nur Bestellen“? Dann kassiert
 * OpenEOS nicht: Auswertung und Dashboard zeigen Mengen und Bestellwerte
 * (nicht kassiert) statt Umsatz.
 */
export function useOrderOnly(): boolean {
  return useAuthStore((state) => isOrderOnlyMode(state.currentOrganization?.organization?.settings));
}
