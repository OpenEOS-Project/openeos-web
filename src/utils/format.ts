/**
 * Format a number as currency (EUR)
 */
export function formatCurrency(amount: number | string, locale: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

/**
 * Format a date string. Returns '—' for null/undefined/invalid input.
 */
export function formatDate(date: string | Date | null | undefined, locale: string): string {
  if (date === null || date === undefined || date === '') return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
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
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
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
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Prozentwert, der bereits in Prozent vorliegt (12.5 → "12,5 %").
 * Intl setzt Dezimaltrenner und Abstand vor dem Zeichen je Sprache richtig
 * ("12,5 %" im Deutschen, "12.5%" im Englischen) — `toFixed(1) + '%'`
 * ergab ueberall "12.5%".
 */
export function formatPercent(value: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

/**
 * Compact timestamp for chat-style messages: day, month and time without the
 * year ("06.10., 14:05" in German, "10/06, 2:05 PM" in English).
 */
export function formatChatTimestamp(date: string | Date, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
