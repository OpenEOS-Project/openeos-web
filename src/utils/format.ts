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
