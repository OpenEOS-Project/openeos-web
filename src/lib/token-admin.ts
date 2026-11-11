/**
 * Wertmarken in der Verwaltung: Regeln des Formulars „Markentyp“ und
 * Hilfen für Auswertung, Umsatzsteuer und Kellnerabrechnung.
 *
 * Steuerberater 2026-11-10, Frage 13 (siehe src/types/token.ts):
 * - Mehrzweckgutschein (Standard): Verkauf nicht steuerbar, Steuer bei der
 *   Einlösung mit dem Satz der Ware.
 * - Einzweckgutschein nur, wenn alle zuordenbaren Artikel genau einen Satz
 *   haben; versteuert beim Verkauf.
 * - Kleinunternehmer buchen immer als Mehrzweck — das Formular bietet
 *   Einzweck dann gar nicht erst an.
 *
 * Maßgeblich ist die API (token-types.service.ts); die Prüfung hier zeigt
 * dieselben Fehler nur schon vor dem Speichern.
 */
import type { OperatingModeView } from '@/lib/operating-mode';
import { taxRatesFor } from '@/lib/tax-rates';
import { ApiException } from '@/types/api';
import type { VatReport } from '@/types/report';
import type {
  TokenFigures,
  TokenKind,
  TokenReportRow,
  TokenTransaction,
  TokenTransactionLine,
  TokenType,
  TokenTypeInput,
} from '@/types/token';

export const TOKEN_NAME_MAX = 100;
export const TOKEN_VALUE_MIN = 0.01;
export const TOKEN_VALUE_MAX = 1000;
/** Vorgabe für neue Marken (Amber, aus der Farbauswahl). */
export const DEFAULT_TOKEN_COLOR = '#f59e0b';

/* ── Betriebsart ───────────────────────────────────────────────────── */

export type TokensUnavailableReason = 'ordersOnly' | 'cashless' | 'tseRequired';

/**
 * Warum gibt es an der Kasse keine Wertmarken? Marken werden an Geldes
 * statt angenommen (Kassenfunktion wie Bargeld): nur „Alle Funktionen“, in
 * Deutschland nur mit aktiver Cloud-TSE. `null` = erlaubt.
 */
export function tokensUnavailableReason(
  view: Pick<OperatingModeView, 'mode' | 'tokensAllowed'>,
): TokensUnavailableReason | null {
  if (view.tokensAllowed) return null;
  if (view.mode === 'orders_only') return 'ordersOnly';
  if (view.mode === 'cashless') return 'cashless';
  return 'tseRequired';
}

/* ── Formular ──────────────────────────────────────────────────────── */

export interface TokenTypeFormValues {
  name: string;
  value: number;
  kind: TokenKind;
  vatRate: number | null;
  eventId: string | null;
  allowedCategoryIds: string[];
  allowedProductIds: string[];
  color: string | null;
  buybackAllowed: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** Artikel, wie sie die Auswahl braucht (Steuersatz kann als Text kommen). */
export interface TokenProductLike {
  id: string;
  categoryId: string;
  taxRate?: number | string | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Sätze, die ein Einzweckgutschein haben kann: die Sätze der Organisation
 * ohne 0 % (die API verlangt einen Satz > 0). Leer = kein Einzweck
 * (Kleinunternehmer oder ein Land ohne geprüfte Sätze).
 */
export function singlePurposeRates(country: string | null | undefined, vatExempt: boolean | undefined): number[] {
  return taxRatesFor(country ?? undefined, vatExempt)
    .map((option) => option.rate)
    .filter((rate) => rate > 0);
}

export function singlePurposeAvailable(country: string | null | undefined, vatExempt: boolean | undefined): boolean {
  return singlePurposeRates(country, vatExempt).length > 0;
}

/** Werte des Formulars für einen bestehenden oder neuen Markentyp. */
export function tokenTypeFormDefaults(type?: TokenType | null): TokenTypeFormValues {
  if (!type) {
    return {
      name: '',
      value: 0,
      kind: 'multi_purpose',
      vatRate: null,
      eventId: null,
      allowedCategoryIds: [],
      allowedProductIds: [],
      color: DEFAULT_TOKEN_COLOR,
      buybackAllowed: false,
      isActive: true,
      sortOrder: 0,
    };
  }
  return {
    name: type.name,
    value: Number(type.value) || 0,
    kind: type.kind,
    vatRate: type.vatRate === null || type.vatRate === undefined ? null : Number(type.vatRate),
    eventId: type.eventId ?? null,
    allowedCategoryIds: [...(type.allowedCategoryIds ?? [])],
    allowedProductIds: [...(type.allowedProductIds ?? [])],
    color: type.color ?? null,
    buybackAllowed: !!type.buybackAllowed,
    isActive: type.isActive,
    sortOrder: type.sortOrder ?? 0,
  };
}

export function hasRestriction(values: Pick<TokenTypeFormValues, 'allowedCategoryIds' | 'allowedProductIds'>): boolean {
  return values.allowedCategoryIds.length > 0 || values.allowedProductIds.length > 0;
}

/** Artikel, die eine Auswahl aus Kategorien und Artikeln trifft (ohne Doppelte). */
export function restrictedProducts<T extends TokenProductLike>(
  products: T[],
  categoryIds: string[],
  productIds: string[],
): T[] {
  const categories = new Set(categoryIds);
  const direct = new Set(productIds);
  return products.filter((p) => categories.has(p.categoryId) || direct.has(p.id));
}

/** Verschiedene Steuersätze der Artikel, absteigend (wie die API). */
export function distinctRates(products: TokenProductLike[]): number[] {
  return [...new Set(products.map((p) => round2(Number(p.taxRate) || 0)))].sort((a, b) => b - a);
}

export type TokenFormField = 'name' | 'value' | 'kind' | 'vatRate' | 'eventId' | 'restriction';
export type TokenFormError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'valueRange'
  | 'smallBusiness'
  | 'rateRequired'
  | 'restrictionRequiresEvent'
  | 'noProducts'
  | 'mixedRates';

export interface TokenFormIssue {
  field: TokenFormField;
  error: TokenFormError;
  /** mixedRates: gefundene Sätze und der gewählte Satz. */
  rates?: number[];
  rate?: number;
}

/**
 * Prüft das Formular wie die API. `products` = Artikel der gewählten
 * Veranstaltung; solange sie fehlen (laden noch), entfällt die Prüfung der
 * Sätze — die API prüft ohnehin.
 */
export function validateTokenTypeForm(
  values: TokenTypeFormValues,
  context: { vatExempt: boolean | undefined; products?: TokenProductLike[] | null },
): TokenFormIssue[] {
  const issues: TokenFormIssue[] = [];
  const name = values.name.trim();
  if (!name) issues.push({ field: 'name', error: 'nameRequired' });
  else if (name.length > TOKEN_NAME_MAX) issues.push({ field: 'name', error: 'nameTooLong' });

  const value = Number(values.value);
  if (
    !Number.isFinite(value) ||
    value < TOKEN_VALUE_MIN ||
    value > TOKEN_VALUE_MAX ||
    Math.abs(round2(value) - value) > 1e-9
  ) {
    issues.push({ field: 'value', error: 'valueRange' });
  }

  const restricted = hasRestriction(values);
  if (restricted && !values.eventId) {
    issues.push({ field: 'restriction', error: 'restrictionRequiresEvent' });
  }

  if (values.kind === 'single_purpose') {
    if (context.vatExempt !== false) {
      issues.push({ field: 'kind', error: 'smallBusiness' });
      return issues;
    }
    const rate = Number(values.vatRate);
    if (values.vatRate === null || !(rate > 0)) {
      issues.push({ field: 'vatRate', error: 'rateRequired' });
      return issues;
    }
    if (restricted && values.eventId && context.products) {
      const affected = restrictedProducts(context.products, values.allowedCategoryIds, values.allowedProductIds);
      if (affected.length === 0) {
        issues.push({ field: 'restriction', error: 'noProducts' });
      } else {
        const rates = distinctRates(affected);
        if (rates.length > 1 || rates[0] !== round2(rate)) {
          issues.push({ field: 'restriction', error: 'mixedRates', rates, rate: round2(rate) });
        }
      }
    }
  }
  return issues;
}

/** Was sich nicht mehr ändern lässt, sobald Marken verkauft/angenommen wurden (wie die API). */
export function lockedTokenFields(type: Pick<TokenType, 'inUse' | 'kind'> | null | undefined): {
  value: boolean;
  kind: boolean;
  vatRate: boolean;
  /** Veranstaltung und Artikelauswahl (nur beim Einzweckgutschein fest). */
  restriction: boolean;
} {
  const inUse = !!type?.inUse;
  return {
    value: inUse,
    kind: inUse,
    vatRate: inUse,
    restriction: inUse && type?.kind === 'single_purpose',
  };
}

/**
 * Daten für POST/PATCH. Mehrzweck ohne Satz; ohne Veranstaltung keine
 * Auswahl (die API lehnt sie dann ab, das Formular blendet sie aus).
 */
export function tokenTypePayload(values: TokenTypeFormValues): TokenTypeInput {
  const single = values.kind === 'single_purpose';
  return {
    name: values.name.trim(),
    value: round2(Number(values.value)),
    kind: values.kind,
    vatRate: single && values.vatRate !== null ? Number(values.vatRate) : null,
    eventId: values.eventId || null,
    allowedCategoryIds: values.eventId ? [...new Set(values.allowedCategoryIds)] : [],
    allowedProductIds: values.eventId ? [...new Set(values.allowedProductIds)] : [],
    color: values.color || null,
    buybackAllowed: values.buybackAllowed,
    isActive: values.isActive,
    sortOrder: Math.max(0, Math.round(Number(values.sortOrder) || 0)),
  };
}

/** Satz als Text („19 %“, „5,5 %“ auf Deutsch). */
export function formatRate(rate: number, locale: string): string {
  const text = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 2 }).format(rate);
  return `${text} %`;
}

/**
 * TOKEN_SINGLE_PURPOSE_MIXED_RATES liefert `params.rates` als Liste — die
 * Übersetzung braucht Text („19 %, 7 %“). Andere Fehler bleiben, wie sie sind.
 */
export function normalizeTokenApiError(error: unknown, locale: string): unknown {
  if (!(error instanceof ApiException) || !error.params) return error;
  const raw = (error.params as Record<string, unknown>).rates;
  if (!Array.isArray(raw)) return error;
  const rates = raw.map((r) => formatRate(Number(r), locale)).join(', ');
  return new ApiException(error.code, error.message, error.status, error.details, error.reason, {
    ...error.params,
    rates,
  });
}

/* ── Anzeige ───────────────────────────────────────────────────────── */

/** Badge der Art: „Mehrzweck“ oder „Einzweck 19 %“. */
export function tokenKindBadge(type: Pick<TokenType, 'kind' | 'vatRate'>): { key: 'multi' | 'single'; rate: number | null } {
  if (type.kind === 'single_purpose') {
    const rate = type.vatRate === null || type.vatRate === undefined ? null : Number(type.vatRate);
    return { key: 'single', rate };
  }
  return { key: 'multi', rate: null };
}

/** Stückzahl ohne überflüssige Nachkommastellen (API rundet auf 3). */
export function formatTokenCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 3 }).format(count);
}

/** Positionen eines Vorgangs als Text: „9 × 2-€-Marke, 1 × 5-€-Marke“. */
export function tokenLinesLabel(
  lines: Pick<TokenTransactionLine, 'count' | 'name'>[],
  locale: string,
): string {
  return lines.map((line) => `${formatTokenCount(Math.abs(line.count), locale)} × ${line.name}`).join(', ');
}

/** Betrag eines Vorgangs mit Vorzeichen: Verkauf +, Rücktausch −. */
export function signedTransactionAmount(tx: Pick<TokenTransaction, 'kind' | 'totalAmount'>): number {
  const amount = Math.abs(Number(tx.totalAmount) || 0);
  return tx.kind === 'buyback' ? -amount || 0 : amount;
}

export function hasTokenFigures(figures: TokenFigures | null | undefined): boolean {
  return !!figures && (figures.count !== 0 || figures.amount !== 0);
}

/** Hat die Zeile irgendeine Bewegung? (Typen ohne Bewegung liefert die API mit Nullen.) */
export function tokenRowHasMovement(
  row: Pick<TokenReportRow, 'sold' | 'redeemed' | 'returned' | 'boughtBack' | 'outstanding'>,
): boolean {
  return (
    hasTokenFigures(row.sold) ||
    hasTokenFigures(row.redeemed) ||
    hasTokenFigures(row.returned) ||
    hasTokenFigures(row.boughtBack) ||
    hasTokenFigures(row.outstanding)
  );
}

/** Kennzahlen in der Reihenfolge der Tabelle (für Anzeige und CSV). */
export const TOKEN_REPORT_FIGURES = ['sold', 'redeemed', 'returned', 'boughtBack', 'outstanding'] as const;
export type TokenReportFigure = (typeof TOKEN_REPORT_FIGURES)[number];

/** CSV-Zeilen der Auswertung je Typ: Name, je Kennzahl Stück und Euro. */
export function tokenReportCsvRows(
  rows: Pick<TokenReportRow, 'name' | TokenReportFigure>[],
  totals?: Pick<TokenReportRow, TokenReportFigure> & { name: string },
): Array<Array<string | number>> {
  const line = (row: Pick<TokenReportRow, 'name' | TokenReportFigure>) => [
    row.name,
    ...TOKEN_REPORT_FIGURES.flatMap((key) => [row[key].count, row[key].amount]),
  ];
  return [...rows.map(line), ...(totals ? [line(totals)] : [])];
}

/* ── Umsatzsteuer ──────────────────────────────────────────────────── */

/** Spalte „Einzweck-Marken“ nur, wenn eine Zeile einen Betrag hat. */
export function vatHasSinglePurposeTokens(report: Pick<VatReport, 'rows'> | null | undefined): boolean {
  return (report?.rows ?? []).some((row) => Math.round((row.singlePurposeTokens ?? 0) * 100) !== 0);
}

/** Vermerk Mehrzweck-Marken (nicht steuerbar), null ohne Bewegung. */
export function multiPurposeTokenNote(
  report: Pick<VatReport, 'multiPurposeTokens'> | null | undefined,
): { sold: number; boughtBack: number } | null {
  const tokens = report?.multiPurposeTokens;
  if (!tokens) return null;
  const sold = Number(tokens.sold) || 0;
  const boughtBack = Math.abs(Number(tokens.boughtBack) || 0);
  if (Math.round(sold * 100) === 0 && Math.round(boughtBack * 100) === 0) return null;
  return { sold, boughtBack };
}
