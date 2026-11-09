'use client';

import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import type { CartContents } from '@/stores/cart-store';
import type { PosTableContext } from '@/types/table';
import type { PosWaiter } from '@/types/waiter';

/** Geparkter Stand einer Bedienung an diesem Gerät (nur im Speicher). */
export interface WaiterParking {
  cart: CartContents;
  /** Geparkte Tisch-Warenkörbe dieser Bedienung (Schlüssel wie im Warenkorb). */
  parked: Record<string, unknown>;
  table: PosTableContext | null;
  savedAt: number;
}

interface WaiterSessionState {
  /** Angemeldete Bedienung bzw. Mitglied; `null` = PIN-Bildschirm (shared). */
  waiter: PosWaiter | null;
  expiresAt: string | null;
  /** Warum zuletzt gesperrt wurde (Hinweis auf dem PIN-Bildschirm). */
  lockReason: 'lock' | 'switch' | 'timeout' | 'expired' | 'revoked' | null;
  parking: Record<string, WaiterParking>;
  start: (waiter: PosWaiter, token: string | null, expiresAt: string | null) => void;
  /** Sitzung lokal beenden (Token weg). */
  clear: (reason?: WaiterSessionState['lockReason']) => void;
  park: (waiterId: string, parking: WaiterParking) => void;
  /** Geparkten Stand holen und entfernen. */
  take: (waiterId: string) => WaiterParking | null;
}

/**
 * Bedienungs-Sitzung der Kasse. Bewusst ohne `persist`: Token und
 * geparkte Warenkörbe bleiben im Speicher des Geräts (Plan §11).
 */
export const useWaiterSessionStore = create<WaiterSessionState>()((set, get) => ({
  waiter: null,
  expiresAt: null,
  lockReason: null,
  parking: {},
  start: (waiter, token, expiresAt) => {
    apiClient.setWaiterSessionToken(token);
    set({ waiter, expiresAt, lockReason: null });
  },
  clear: (reason = null) => {
    apiClient.setWaiterSessionToken(null);
    set({ waiter: null, expiresAt: null, lockReason: reason });
  },
  park: (waiterId, parking) => set({ parking: { ...get().parking, [waiterId]: parking } }),
  take: (waiterId) => {
    const found = get().parking[waiterId] ?? null;
    if (found) {
      const rest = { ...get().parking };
      delete rest[waiterId];
      set({ parking: rest });
    }
    return found;
  },
}));
