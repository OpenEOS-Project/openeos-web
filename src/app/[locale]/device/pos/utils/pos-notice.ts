import type { EventPhase } from '@/types/event';

/**
 * Der eine Hinweis unter dem Kopf der Kasse. Nie mehrere übereinander:
 * „Beendet“ vor Testbetrieb/Testmodus vor den übrigen Hinweisen. Im
 * Testbetrieb sind Buchungen ohnehin Training (auch mit Cloud-TSE) — dafür
 * gibt es keinen eigenen Hinweis. Offline zeigt der Kopf zusätzlich am
 * Verbindungspunkt.
 */
export type PosNotice =
  | 'ended'
  | 'planned'
  | 'test'
  | 'offline'
  | 'tseOutage'
  | 'cashBlocked'
  | 'orderOnly';

export interface PosNoticeInput {
  phase: EventPhase | null;
  offline: boolean;
  tseOutage: boolean;
  cashBlocked: boolean;
  orderOnly: boolean;
}

export function posNotice({ phase, offline, tseOutage, cashBlocked, orderOnly }: PosNoticeInput): PosNotice | null {
  if (phase === 'ended') return 'ended';
  if (phase === 'planned') return 'planned';
  if (phase === 'test') return 'test';
  if (offline) return 'offline';
  if (tseOutage) return 'tseOutage';
  if (cashBlocked) return 'cashBlocked';
  if (orderOnly) return 'orderOnly';
  return null;
}
