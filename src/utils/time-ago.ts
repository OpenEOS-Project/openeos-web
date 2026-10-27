/**
 * "vor 3 Minuten" / "3 minutes ago" for "last seen" columns. `now` can be
 * injected for tests. Returns '' for missing or unparsable dates; anything
 * in the future reads as "now" (clock skew between agent and browser).
 */
export function formatTimeAgo(
  value: string | Date | null | undefined,
  locale: string,
  now: number = Date.now(),
): string {
  if (!value) return '';
  const ts = typeof value === 'string' ? new Date(value).getTime() : value.getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Math.max(0, now - ts);
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  // 0 seconds reads as "jetzt" / "now"; 0 minutes would be "in dieser Minute".
  if (minutes < 1) return rtf.format(0, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-days, 'day');
}
