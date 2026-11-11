/**
 * DSFinV-K (Kassenabschlüsse, Export für die Kassen-Nachschau) und
 * Kassenbuch — Antworten der API. Geschäftstage laufen von 6 bis 6 Uhr
 * (Europe/Berlin) und werden als 'YYYY-MM-DD' übergeben.
 */
import type { TseReceiptView } from './tse';

export interface CashPointClosingTotals {
  grossCents: number;
  paymentsCents: number;
  cashCents: number;
  byBusinessCase: {
    gvTyp: string;
    gvName: string;
    vatKey: number;
    grossCents: number;
    netCents: number;
    vatCents: number;
  }[];
  byPaymentType: { type: string; name: string; cents: number }[];
  byVatKey: { vatKey: number; grossCents: number; netCents: number; vatCents: number }[];
  counts: {
    transactions: number;
    receipts: number;
    training: number;
    orders: number;
    failed: number;
    cancelled: number;
  };
  firstBonId: number | null;
  lastBonId: number | null;
}

/** Ein Kassenabschluss (Z-Bon) — unveränderlich. */
export interface CashPointClosingView {
  id: string;
  zNr: number;
  registerId: string;
  /** Geschäftstag 'YYYY-MM-DD'. */
  businessDate: string;
  periodFrom: string | null;
  periodTo: string;
  createdAt: string;
  trigger: 'scheduled' | 'manual';
  firstBonId: number | null;
  lastBonId: number | null;
  transactionCount: number;
  totals: CashPointClosingTotals;
  contentSha256: string;
  exportSha256: string | null;
  exportSizeBytes: number | null;
  exportedAt: string | null;
  archivedAt: string | null;
}

/** GET /organizations/:id/dsfinvk/closings */
export interface CashPointClosingList {
  items: CashPointClosingView[];
  registerId: string;
  /** Vorgänge, die noch in keinem Abschluss stehen. */
  open: { transactions: number; since: string | null };
}

export interface DsfinvkClosingsQuery {
  from?: string;
  to?: string;
  limit?: number;
}

/** Datei aus einem Download-Endpunkt (ZIP/TAR). */
export interface DownloadedFile {
  blob: Blob;
  /** Aus `Content-Disposition`, sonst null (Header nicht freigegeben). */
  filename: string | null;
  sha256: string | null;
}

// ── Kassenbuch ─────────────────────────────────────────────────────────

export type CashbookEntryType = 'opening_balance' | 'deposit' | 'withdrawal' | 'cash_count';
export type CashbookScope = 'device' | 'register';

export interface CashbookEntryView {
  id: string;
  businessDate: string;
  type: CashbookEntryType;
  /** Geschäftsvorfall der DSFinV-K: Anfangsbestand, Geldtransit, DifferenzSollIst. */
  businessCase: string;
  /** Betrag in Euro mit Vorzeichen (Entnahme negativ, Kassensturz = Differenz Ist − Soll). */
  amount: number;
  countedAmount: number | null;
  expectedAmount: number | null;
  scope: CashbookScope;
  note: string | null;
  deviceId: string | null;
  deviceName: string | null;
  userId: string | null;
  userName: string | null;
  tseTransactionId: string | null;
  createdAt: string;
}

/** Bargeld einer Schublade bzw. der ganzen Kasse an einem Geschäftstag (Euro). */
export interface CashSummary {
  openingBalance: number;
  deposits: number;
  withdrawals: number;
  cashSales: number;
  cashRefunds: number;
  pfandPayouts: number;
  /** Barauszahlung von Kartentrinkgeld an Arbeitnehmer (negativ); fehlt bei älteren APIs. */
  tipPayouts?: number;
  differences: number;
  /** Soll-Bestand. */
  expected: number;
  lastCount: { at: string; counted: number; difference: number } | null;
}

export interface CashbookDay {
  businessDate: string;
  from: string;
  to: string;
  cashAllowed: boolean;
  tseActive: boolean;
  entries: CashbookEntryView[];
  total: CashSummary;
  /**
   * Vorschlag für den Anfangsbestand: zuletzt gezählter Bestand vor diesem
   * Geschäftstag (Restbestand aus dem Vorabschluss). null = noch nie
   * gezählt; fehlt bei älteren API-Versionen.
   */
  openingBalanceSuggestion?: CashbookOpeningSuggestion | null;
  devices: { deviceId: string | null; deviceName: string | null; summary: CashSummary }[];
}

export interface CashbookOpeningSuggestion {
  amount: number;
  /** Geschäftstag des Kassensturzes (YYYY-MM-DD). */
  fromBusinessDate: string;
}

export interface CreateCashbookEntryData {
  type: CashbookEntryType;
  /** Euro, immer positiv; beim Kassensturz der gezählte Bestand. */
  amount: number;
  note?: string;
  scope?: CashbookScope;
}

export interface CashbookEntryResult {
  entry: CashbookEntryView;
  tse: TseReceiptView | null;
  summary: CashSummary;
}
