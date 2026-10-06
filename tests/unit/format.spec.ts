import { expect, test } from '@playwright/test';

import { formatCurrency, formatDate, formatDateTime, formatTime, toIntlLocale } from '@/utils/format';

import { inTimeZone, TIME_ZONES } from './helpers';

/** Intl trennt Betrag und Zeichen teils mit geschuetztem Leerzeichen. */
const plain = (value: string) => value.replace(/[  ]/g, ' ');

test.describe('format: English uses the British format', () => {
  test('maps interface languages to Intl locales', () => {
    expect(toIntlLocale('en')).toBe('en-GB');
    expect(toIntlLocale('de')).toBe('de-DE');
    expect(toIntlLocale('de-AT')).toBe('de-AT');
  });

  test('dates are day/month/year in English', () => {
    expect(formatDate('2026-09-12T10:00:00', 'en')).toBe('12/09/2026');
    expect(formatDate('2026-09-12T10:00:00', 'de')).toBe('12.09.2026');
  });

  test('times use the 24-hour clock in English', () => {
    expect(formatTime(new Date(2026, 8, 12, 14, 5), 'en')).toBe('14:05');
    expect(formatDateTime(new Date(2026, 8, 12, 14, 5), 'en')).toBe('12/09/2026, 14:05');
  });

  test('currency stays euro', () => {
    expect(plain(formatCurrency(3.5, 'en'))).toBe('€3.50');
    expect(plain(formatCurrency(3.5, 'de'))).toBe('3,50 €');
  });

  for (const timeZone of TIME_ZONES) {
    test(`a plain calendar day is not shifted (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        expect(formatDate('2026-09-12', 'de')).toBe('12.09.2026');
        expect(formatDate('2026-09-12', 'en')).toBe('12/09/2026');
      });
    });
  }
});
