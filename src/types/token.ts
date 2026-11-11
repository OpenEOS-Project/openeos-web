/**
 * Wertmarken (Steuerberater 2026-11-10, Frage 13):
 * - `multi_purpose` = Mehrzweckgutschein (Standard): Verkauf nicht
 *   steuerbar, Umsatzsteuer bei der Einlösung mit dem Satz der Ware.
 * - `single_purpose` = Einzweckgutschein: nur für Artikel mit genau einem
 *   Steuersatz, versteuert beim Verkauf.
 */
export type TokenKind = 'multi_purpose' | 'single_purpose';

export interface TokenType {
  id: string;
  organizationId: string;
  /** Leer = alle Veranstaltungen. */
  eventId: string | null;
  name: string;
  /** Nennwert in Euro (decimal kann als Text kommen). */
  value: number | string;
  kind: TokenKind;
  vatRate: number | string | null;
  allowedCategoryIds: string[];
  allowedProductIds: string[];
  color: string | null;
  /** Rücktausch gegen Bargeld an der Kasse erlaubt. */
  buybackAllowed: boolean;
  isActive: boolean;
  sortOrder: number;
  /** Schon verkauft/eingelöst: Nennwert, Art und Satz sind fest. */
  inUse?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TokenTypeInput {
  name?: string;
  value?: number;
  kind?: TokenKind;
  vatRate?: number | null;
  eventId?: string | null;
  allowedCategoryIds?: string[];
  allowedProductIds?: string[];
  color?: string | null;
  buybackAllowed?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

/** Vom Gast erhaltene Marken eines Typs. */
export interface TokenTender {
  tokenTypeId: string;
  count: number;
}

export interface TokenTransactionLine {
  tokenTypeId: string;
  name: string;
  kind: TokenKind;
  unitValue: number;
  count: number;
  amount: number;
  vatRate: number | null;
}

export interface TokenTransaction {
  id: string;
  organizationId: string;
  eventId: string | null;
  kind: 'sale' | 'buyback';
  transactionNumber: string;
  lines: TokenTransactionLine[];
  totalAmount: number | string;
  taxLines: { rate: number; gross: number; net: number; tax: number }[];
  paymentMethod: 'cash' | 'card' | 'sumup_terminal';
  amountReceived: number | string | null;
  reason: string | null;
  isTest: boolean;
  actorName: string | null;
  createdAt: string;
  tse?: import('./tse').TseReceiptView | null;
  printed?: boolean;
}

export interface TokenFigures {
  count: number;
  amount: number;
}

export interface TokenReportRow {
  tokenTypeId: string;
  name: string;
  kind: TokenKind;
  value: number;
  eventId: string | null;
  eventName: string | null;
  sold: TokenFigures;
  redeemed: TokenFigures;
  /** Bei Storno/Erstattung an den Gast zurückgegeben. */
  returned: TokenFigures;
  boughtBack: TokenFigures;
  outstanding: TokenFigures;
}

export interface TokenReport {
  types: TokenReportRow[];
  byEvent: TokenReportRow[];
  totals: Pick<TokenReportRow, 'sold' | 'redeemed' | 'returned' | 'boughtBack' | 'outstanding'>;
}

/** Mit Marken beglichener Anteil einer Zahlung (Verlauf). */
export interface PaymentTokenLine {
  tokenTypeId: string;
  name: string;
  kind: TokenKind;
  unitValue: number;
  count: number;
  amount: number;
  vatRate: number | null;
}

/** Nennwert als Zahl. */
export function tokenValue(type: Pick<TokenType, 'value'>): number {
  return Number(type.value) || 0;
}

/** Wert der Marken in Cent (exakt). */
export function tokensValueCents(types: TokenType[], counts: Record<string, number>): number {
  return types.reduce((sum, t) => sum + Math.round(tokenValue(t) * 100) * Math.max(0, counts[t.id] || 0), 0);
}

/** Marken mit Anzahl > 0 für die API. */
export function tokenTenders(counts: Record<string, number>): TokenTender[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([tokenTypeId, count]) => ({ tokenTypeId, count: Math.round(count) }));
}
