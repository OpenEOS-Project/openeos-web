import { expect, test } from '@playwright/test';

import { formatTimeAgo } from '@/utils/time-ago';

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);

test.describe('formatTimeAgo', () => {
  test('rundet auf Minuten, Stunden und Tage', () => {
    expect(formatTimeAgo(new Date(NOW - 20_000), 'de', NOW)).toBe('jetzt');
    expect(formatTimeAgo(new Date(NOW - 3 * 60_000), 'de', NOW)).toBe('vor 3 Minuten');
    expect(formatTimeAgo(new Date(NOW - 2 * 3_600_000), 'en', NOW)).toBe('2 hours ago');
    expect(formatTimeAgo(new Date(NOW - 1 * 86_400_000), 'en', NOW)).toBe('yesterday');
    expect(formatTimeAgo(new Date(NOW - 5 * 86_400_000), 'de', NOW)).toBe('vor 5 Tagen');
  });

  test('nimmt ISO-Strings und behandelt Zukunft als jetzt', () => {
    expect(formatTimeAgo(new Date(NOW - 10 * 60_000).toISOString(), 'de', NOW)).toBe('vor 10 Minuten');
    expect(formatTimeAgo(new Date(NOW + 60_000), 'de', NOW)).toBe('jetzt');
  });

  test('leer bei fehlenden oder kaputten Werten', () => {
    expect(formatTimeAgo(null, 'de', NOW)).toBe('');
    expect(formatTimeAgo(undefined, 'de', NOW)).toBe('');
    expect(formatTimeAgo('kein Datum', 'de', NOW)).toBe('');
  });
});
