/**
 * DSFinV-K und Kassenbuch: reine Hilfen für Kassen-Nachschau, Kassenbuch
 * (Kasse und Verwaltung) und die Steuerangaben der Organisation.
 */
import { addDays, type DayKey } from '@/utils/calendar-date';
import type {
  CashbookEntryType,
  CashbookEntryView,
  CashbookOpeningSuggestion,
  CashPointClosingTotals,
  CashSummary,
} from '@/types/dsfinvk';
import type { OrganizationSettings } from '@/types/organization';
import type { TseMasterDataField } from '@/types/tse';

/** Zeitzone der Geschäftstage (wie die API). */
const BUSINESS_TIME_ZONE = 'Europe/Berlin';
/** Ein Geschäftstag beginnt um 6 Uhr (Berliner Zeit). */
const BUSINESS_DAY_START_HOUR = 6;

/**
 * Geschäftstag eines Zeitpunkts: 6–6 Uhr in Berlin. Vor 6 Uhr zählt noch
 * der Vortag (das Fest geht nach Mitternacht weiter).
 */
export function businessDateOf(now: Date = new Date()): DayKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return Number(get('hour')) < BUSINESS_DAY_START_HOUR ? addDays(day, -1) : day;
}

/** Liegt der heutige Geschäftstag im Zeitraum (beide Tage eingeschlossen)? */
export function rangeIncludesToday(from: DayKey, to: DayKey, now: Date = new Date()): boolean {
  const today = businessDateOf(now);
  return from <= today && today <= to;
}

/** Zeitraum gültig: beide Tage gesetzt, Ende nicht vor Beginn. */
export function isValidRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}

/** Ersatzname, falls die API den Dateinamen nicht per CORS freigibt. */
export function fallbackFilename(kind: 'dsfinvk' | 'tse', from: string, to: string): string {
  const range = from === to ? from : `${from}_${to}`;
  return kind === 'dsfinvk' ? `dsfinvk_${range}.zip` : `tse-export_${range}.zip`;
}

/** Blob als Datei speichern (wie der Download der TSE-Exporte). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Cent → Euro für die Anzeige. */
export function centsToEuros(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

/** Geschäftsvorfälle der DSFinV-K, die Umsatz sind (nicht Pfand, Trinkgeld, Geldtransit …). */
const SALES_BUSINESS_CASES = new Set(['Umsatz', 'Rabatt', 'Aufschlag']);

/**
 * Umsatz brutto eines Abschlusses: nur die Umsatz-Vorfälle. `grossCents`
 * der API ist die Summe aller Vorfälle — mit Anfangsbestand, Einlagen und
 * Entnahmen wäre das kein Umsatz.
 */
export function salesGrossCents(totals: Pick<CashPointClosingTotals, 'byBusinessCase'>): number {
  return totals.byBusinessCase
    .filter((line) => SALES_BUSINESS_CASES.has(line.gvTyp))
    .reduce((sum, line) => sum + line.grossCents, 0);
}

// ── Steuerangaben ──────────────────────────────────────────────────────

/** USt-IdNr. ohne Leerzeichen, in Großbuchstaben (so speichert sie die API). */
export function normalizeVatId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** USt-IdNr.: zwei Buchstaben Ländercode, dann 2–13 Ziffern/Zeichen (DE: 9 Ziffern). */
export function isValidVatId(value: string): boolean {
  const vat = normalizeVatId(value);
  if (!vat) return true;
  if (vat.startsWith('DE')) return /^DE\d{9}$/.test(vat);
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(vat);
}

/** Steuernummer: Ziffern mit Schrägstrichen/Leerzeichen, 10–13 Ziffern. */
export function isValidTaxNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[0-9/\s-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '').length;
  return digits >= 10 && digits <= 13;
}

/**
 * Was für die Cloud-TSE (DSFinV-K-Stammdaten) noch fehlt — dieselbe Regel
 * wie die API: Steuernummer oder USt-IdNr., Straße, PLZ, Ort.
 */
export function missingMasterData(settings: Partial<OrganizationSettings> | null | undefined): TseMasterDataField[] {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const s = settings ?? {};
  const missing: TseMasterDataField[] = [];
  if (!text(s.taxNumber) && !text(s.vatId)) missing.push('taxNumber');
  if (!text(s.contact?.address) && !text(s.address?.street)) missing.push('street');
  if (!text(s.contact?.zipCode) && !text(s.address?.zip)) missing.push('zip');
  if (!text(s.contact?.city) && !text(s.address?.city)) missing.push('city');
  return missing;
}

/** Doku-Seite „Kassen-Nachschau“ je Sprache (Doku liegt an der Wurzel von docs.openeos.de). */
export function kassenNachschauDocsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en/kassen-nachschau' : 'https://docs.openeos.de/kassen-nachschau';
}

// ── Kassenbuch ─────────────────────────────────────────────────────────

export const CASHBOOK_ACTIONS: readonly CashbookEntryType[] = ['opening_balance', 'deposit', 'withdrawal', 'cash_count'];

/**
 * Reihenfolge der Buchungen: ohne früheren Kassensturz (kein Restbestand)
 * zuerst „Wechselgeld aus Vereinskasse“ — Wechselgeld ist Geldtransit,
 * kein Anfangsbestand (Steuerberater 2026-11-10, Frage 6).
 */
export function cashbookActionsFor(
  suggestion: CashbookOpeningSuggestion | null | undefined,
): readonly CashbookEntryType[] {
  if (suggestion) return CASHBOOK_ACTIONS;
  return ['deposit', 'opening_balance', 'withdrawal', 'cash_count'];
}

/** Vorbelegung des Betrags (Euro) beim Anfangsbestand, sonst `null`. */
export function openingBalancePrefill(
  type: CashbookEntryType | null,
  suggestion: CashbookOpeningSuggestion | null | undefined,
): number | null {
  if (type !== 'opening_balance' || !suggestion) return null;
  const amount = roundEuros(Number(suggestion.amount));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Euro auf Cent gerundet (gegen 0,1 + 0,2). */
export function roundEuros(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Differenz gezählt − Soll (positiv = mehr in der Kasse als erwartet). */
export function cashDifference(counted: number, expected: number): number {
  return roundEuros(counted - expected);
}

/** Ton einer Differenz: 0 neutral, Überschuss positiv, Fehlbetrag negativ. */
export function differenceTone(difference: number): 'zero' | 'plus' | 'minus' {
  if (Math.abs(difference) < 0.005) return 'zero';
  return difference > 0 ? 'plus' : 'minus';
}

/** Ziffern vom Ziffernblock (Cent) → Euro. */
export function centsInputToEuros(input: string): number {
  return input ? parseInt(input, 10) / 100 : 0;
}

/** Ziffernblock: Taste anwenden (höchstens 7 Stellen = 99.999,99 €). */
export function applyAmountKey(current: string, key: string): string {
  if (key === 'backspace') return current.slice(0, -1);
  if (!/^\d+$/.test(key)) return current;
  return (current + key).replace(/^0+/, '').slice(0, 7);
}

/** Aufschlüsselung des Soll-Bestands in Anzeigereihenfolge (Vorzeichen wie gebucht). */
export function summaryRows(summary: CashSummary): { key: keyof CashSummary; value: number }[] {
  // `|| 0`: keine „-0,00 €“ für leere Abflüsse.
  const out = (value: number) => -Math.abs(value) || 0;
  return [
    { key: 'openingBalance', value: summary.openingBalance },
    { key: 'deposits', value: summary.deposits },
    { key: 'withdrawals', value: out(summary.withdrawals) },
    { key: 'cashSales', value: summary.cashSales },
    { key: 'cashRefunds', value: out(summary.cashRefunds) },
    { key: 'pfandPayouts', value: out(summary.pfandPayouts) },
    // Kartentrinkgeld bar an Arbeitnehmer (ältere APIs liefern es nicht).
    ...(summary.tipPayouts === undefined ? [] : [{ key: 'tipPayouts' as const, value: out(summary.tipPayouts) }]),
    // Wertmarken bar verkauft (rein) bzw. zurückgetauscht (raus) — nur mit Bewegung.
    ...(summary.tokenSales ? [{ key: 'tokenSales' as const, value: Math.abs(summary.tokenSales) }] : []),
    ...(summary.tokenBuybacks ? [{ key: 'tokenBuybacks' as const, value: out(summary.tokenBuybacks) }] : []),
    { key: 'differences', value: summary.differences },
  ];
}

/** Neueste Buchung zuerst. */
export function sortEntriesNewestFirst(entries: CashbookEntryView[]): CashbookEntryView[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
