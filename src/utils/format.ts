import { toLocalDate } from '@/utils/calendar-date';

/**
 * Zeitzone, in der die Oberflaeche Zeitpunkte deutet, solange keine
 * Organisationszeitzone vorliegt (next-intl, Server-Rendering).
 */
export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

/**
 * Sprache der Oberflaeche -> Locale fuer Intl.
 *
 * Intl liest ein nacktes 'en' als amerikanisches Englisch: 09/12/2026,
 * 2:05 PM. Die englische Oberflaeche richtet sich an Vereine in Europa
 * und nutzt deshalb das britische Format (12/09/2026, 14:05). Alle
 * Formatierer laufen hier durch, damit das nicht an jeder Stelle einzeln
 * entschieden wird. Bereits vollstaendige Tags ('de-AT') bleiben.
 */
const INTL_LOCALES: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
};

export function toIntlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

/**
 * Format a number as currency (EUR)
 */
export function formatCurrency(amount: number | string, locale: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

/**
 * Format a date string. Returns '—' for null/undefined/invalid input.
 */
export function formatDate(date: string | Date | null | undefined, locale: string): string {
  if (date === null || date === undefined || date === '') return '—';
  // Reiner Kalendertag ('2026-09-12') als lokale Mitternacht, nicht als
  // Mitternacht UTC — sonst zeigt ein Browser westlich von Greenwich den Vortag.
  const d = toLocalDate(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Format a date and time string. Returns '—' for null/undefined/invalid input.
 */
export function formatDateTime(date: string | Date | null | undefined, locale: string): string {
  if (date === null || date === undefined || date === '') return '—';
  // Reiner Kalendertag ('2026-09-12') als lokale Mitternacht, nicht als
  // Mitternacht UTC — sonst zeigt ein Browser westlich von Greenwich den Vortag.
  const d = toLocalDate(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a time string
 */
export function formatTime(date: string | Date, locale: string): string {
  // Reiner Kalendertag ('2026-09-12') als lokale Mitternacht, nicht als
  // Mitternacht UTC — sonst zeigt ein Browser westlich von Greenwich den Vortag.
  const d = toLocalDate(date);
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(num);
}

/**
 * Prozentwert, der bereits in Prozent vorliegt (12.5 → "12,5 %").
 * Intl setzt Dezimaltrenner und Abstand vor dem Zeichen je Sprache richtig
 * ("12,5 %" im Deutschen, "12.5%" im Englischen) — `toFixed(1) + '%'`
 * ergab ueberall "12.5%".
 */
export function formatPercent(value: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

/**
 * Compact timestamp for chat-style messages: day, month and time without the
 * year ("06.10., 14:05" in German, "06/10, 14:05" in English).
 */
export function formatChatTimestamp(date: string | Date, locale: string): string {
  // Reiner Kalendertag ('2026-09-12') als lokale Mitternacht, nicht als
  // Mitternacht UTC — sonst zeigt ein Browser westlich von Greenwich den Vortag.
  const d = toLocalDate(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
