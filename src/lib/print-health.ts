import type { PrintHealth, PrintHealthPrinter } from '@/types/print-health';

/**
 * Was der Hinweis zum Drucken sagt — eine Aussage, die wichtigste zuerst:
 *
 * 1. Bons warten und ihr Drucker/Agent ist offline (`offlineWaiting`)
 * 2. Bons warten, obwohl alles verbunden ist (`waiting`)
 * 3. Bons sind fehlgeschlagen (`failed`)
 * 4. nur offline: Agent (`agentOffline`) bzw. Drucker (`printerOffline`)
 */
export type PrintHealthNoticeKind = 'offlineWaiting' | 'waiting' | 'failed' | 'agentOffline' | 'printerOffline';

export interface PrintHealthNotice {
  kind: PrintHealthNoticeKind;
  tone: 'danger' | 'warn';
  /** Namen der betroffenen Drucker (für den Titel). */
  printers: string[];
  /** Namen der Agenten ohne Verbindung. */
  agents: string[];
  waitingJobs: number;
  failedJobs: number;
  failedWindowMinutes: number;
}

const isOffline = (p: PrintHealthPrinter) =>
  p.issues.includes('agent_offline') || p.issues.includes('printer_offline');

const names = (printers: PrintHealthPrinter[]) => printers.map((p) => p.name);

export function printHealthNotice(health: PrintHealth | null | undefined): PrintHealthNotice | null {
  if (!health || health.status === 'ok') return null;
  const base = {
    agents: health.offlineAgents.map((a) => a.name).filter(Boolean),
    waitingJobs: health.waitingJobs,
    failedJobs: health.failedJobs,
    failedWindowMinutes: health.thresholds.failedWindowMinutes,
  };

  if (health.waitingJobs > 0) {
    const waiting = health.printers.filter((p) => p.waitingJobs > 0);
    const offline = waiting.filter(isOffline);
    return offline.length > 0
      ? { ...base, kind: 'offlineWaiting', tone: 'danger', printers: names(offline) }
      : { ...base, kind: 'waiting', tone: 'danger', printers: names(waiting) };
  }
  if (health.failedJobs > 0) {
    return {
      ...base,
      kind: 'failed',
      tone: 'danger',
      printers: names(health.printers.filter((p) => p.failedJobs > 0)),
    };
  }
  // Nur offline, aber keine Veranstaltung läuft: zwischen Festen normal.
  if (health.eventRunning === false) return null;
  const agentOffline = health.printers.filter((p) => p.issues.includes('agent_offline'));
  if (agentOffline.length > 0) {
    return { ...base, kind: 'agentOffline', tone: 'warn', printers: names(agentOffline) };
  }
  const printerOffline = health.printers.filter((p) => p.issues.includes('printer_offline'));
  if (printerOffline.length > 0) {
    return { ...base, kind: 'printerOffline', tone: 'warn', printers: names(printerOffline) };
  }
  return null;
}

/**
 * Hinweis im Kopf der Kasse: nur wenn Bons ihrer Drucker warten oder
 * fehlgeschlagen sind. Dass ein Drucker bloß offline ist, ohne dass etwas
 * hängt, zeigt die Kasse nicht — das sieht die Verwaltung.
 */
export interface PosPrintWarning {
  kind: 'waiting' | 'failed';
  count: number;
  printers: string[];
  /** Drucker bzw. Agent ist offline (wartende Bons kommen danach von selbst). */
  offline: boolean;
}

export function posPrintWarning(health: PrintHealth | null | undefined): PosPrintWarning | null {
  if (!health) return null;
  if (health.waitingJobs > 0) {
    const affected = health.printers.filter((p) => p.waitingJobs > 0);
    return {
      kind: 'waiting',
      count: health.waitingJobs,
      printers: names(affected),
      offline: affected.some(isOffline),
    };
  }
  if (health.failedJobs > 0) {
    const affected = health.printers.filter((p) => p.failedJobs > 0);
    return {
      kind: 'failed',
      count: health.failedJobs,
      printers: names(affected),
      offline: affected.some(isOffline),
    };
  }
  return null;
}

/**
 * Druckernamen für einen Satz: „Küche“, „Küche und Bar“, ab vier Namen
 * „Küche, Bar, Theke +2“.
 */
export function joinPrinterNames(list: string[], locale: string, max = 3): string {
  const unique = [...new Set(list.filter(Boolean))];
  if (unique.length > max) {
    return `${unique.slice(0, max).join(', ')} +${unique.length - max}`;
  }
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(unique);
  } catch {
    return unique.join(', ');
  }
}
