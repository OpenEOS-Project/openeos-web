'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import { outageFromViews, receiptTseViews } from '@/lib/tse';
import type { DeviceTseStatus, TseReceiptView } from '@/types/tse';

/**
 * Ausfall der Cloud-TSE aus Sicht dieser Kasse: der letzte eigene Vorgang
 * blieb ohne Signatur (Antwort beim Kassieren) oder der Server meldet einen
 * offenen Ausfall (`GET /device-api/status`, `tseStatusChanged`). Der
 * Hinweis verschwindet mit dem nächsten signierten Vorgang bzw. wenn der
 * Server die Störung als beendet meldet.
 */
interface PosTseState {
  failed: boolean;
  /** TSE-Ergebnisse einer Zahlung/Bestellung melden (Reihenfolge wie die API). */
  report: (views: ReadonlyArray<TseReceiptView | null | undefined>) => void;
  set: (failed: boolean) => void;
}

export const usePosTseStore = create<PosTseState>((set) => ({
  failed: false,
  report: (views) => set((state) => ({ failed: outageFromViews(state.failed, views) })),
  set: (failed) => set({ failed }),
}));

/** Belege einer Antwort sammeln und den Ausfall-Hinweis nachführen. */
export function reportTse(views: ReadonlyArray<TseReceiptView | null | undefined>): TseReceiptView[] {
  usePosTseStore.getState().report(views.filter((v) => !!v));
  return receiptTseViews(views);
}

/**
 * Zeigt die Kasse den Ausfall-Hinweis? Der Server-Zustand gleicht den
 * lokalen ab, sobald er sich ändert (Ausfall auf/zu, auch von anderen Kassen).
 */
export function usePosTseOutage(tse: DeviceTseStatus | null): boolean {
  const failed = usePosTseStore((state) => state.failed);
  const setFailed = usePosTseStore((state) => state.set);
  const serverState = tse?.state ?? null;
  useEffect(() => {
    if (serverState === 'error') setFailed(true);
    else if (serverState === 'ok' || serverState === 'inactive' || serverState === null) setFailed(false);
  }, [serverState, setFailed]);
  return !!tse && (failed || serverState === 'error');
}
