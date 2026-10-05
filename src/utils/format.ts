/**
 * Format a number as currency (EUR)
 */
export function formatCurrency(amount: number | string, locale = 'de-DE'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

/**
 * Format a date string. Returns '—' for null/undefined/invalid input.
 */
export function formatDate(date: string | Date | null | undefined, locale = 'de-DE'): string {
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
export function formatDateTime(date: string | Date | null | undefined, locale = 'de-DE'): string {
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
export function formatTime(date: string | Date, locale = 'de-DE'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(num: number, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Compact timestamp for chat-style messages: "dd.MM. HH:mm" (no year).
 */
/**
 * Prozentwert, der bereits in Prozent vorliegt (12.5 → "12,5 %").
 * Intl setzt Dezimaltrenner und Abstand vor dem Zeichen je Sprache richtig
 * ("12,5 %" im Deutschen, "12.5%" im Englischen) — `toFixed(1) + '%'`
 * ergab ueberall "12.5%".
 */
export function formatPercent(value: number, locale = 'de-DE', fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

export function formatChatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}. ${hh}:${min}`;
}
