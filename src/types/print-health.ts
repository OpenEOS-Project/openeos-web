/**
 * Druck-Zustand einer Organisation bzw. der Drucker einer Kasse
 * (`GET /organizations/:id/print-jobs/health`, `printHealth` in
 * `GET /device-api/status`).
 *
 * - `error`: Bons warten länger als 30 s oder sind in den letzten
 *   15 Minuten fehlgeschlagen
 * - `warning`: nur ein Agent oder Drucker ist offline
 * - `ok`: sonst
 */
export type PrintHealthStatus = 'ok' | 'warning' | 'error';

export type PrintHealthIssue = 'agent_offline' | 'printer_offline' | 'jobs_waiting' | 'jobs_failed';

export interface PrintHealthPrinter {
  printerId: string;
  name: string;
  agentDeviceId: string | null;
  agentName: string | null;
  agentOnline: boolean;
  printerOnline: boolean;
  waitingJobs: number;
  oldestWaitingAt: string | null;
  failedJobs: number;
  issues: PrintHealthIssue[];
}

export interface PrintHealthAgent {
  deviceId: string;
  name: string;
  printerIds: string[];
}

export interface PrintHealth {
  status: PrintHealthStatus;
  checkedAt: string;
  waitingJobs: number;
  failedJobs: number;
  oldestWaitingAt: string | null;
  offlineAgents: PrintHealthAgent[];
  /** Nur Drucker mit mindestens einem Problem. */
  printers: PrintHealthPrinter[];
  thresholds: { waitingSeconds: number; failedWindowMinutes: number };
}
