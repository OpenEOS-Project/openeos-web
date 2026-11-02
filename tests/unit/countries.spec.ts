import { expect, test } from '@playwright/test';

import { COUNTRY_CODES, PRIORITY_COUNTRIES, countryName, countryOptions, normalizeCountry } from '@/lib/countries';

/* Länderauswahl (Registrierung, neue Organisation, Support). */

test.describe('countries', () => {
  test('all 249 ISO codes, DACH on top, rest sorted by name', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(PRIORITY_COUNTRIES).toEqual(['DE', 'AT', 'CH']);
    const { top, rest } = countryOptions('de');
    expect(top.map((c) => c.code)).toEqual(['DE', 'AT', 'CH']);
    expect(top.map((c) => c.name)).toEqual(['Deutschland', 'Österreich', 'Schweiz']);
    expect(rest).toHaveLength(246);
    expect(rest.some((c) => c.code === 'DE')).toBe(false);
    const names = rest.map((c) => c.name);
    expect([...names].sort(new Intl.Collator('de').compare)).toEqual(names);
  });

  test('names follow the UI language', () => {
    expect(countryName('AT', 'en')).toBe('Austria');
    expect(countryName('CH', 'de')).toBe('Schweiz');
  });

  test('normalizeCountry', () => {
    expect(normalizeCountry(' de ')).toBe('DE');
    expect(normalizeCountry('XX')).toBeNull();
    expect(normalizeCountry(undefined)).toBeNull();
  });
});
