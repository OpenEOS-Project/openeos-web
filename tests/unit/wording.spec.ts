import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { taxRatesFor } from '@/lib/tax-rates';

/*
 * Einheitliche Begriffe in den Oberflächentexten (Doku-Abgleich 2026-11):
 * DE „Kassenlade“ und „Rechnung teilen“, EN „till“ für Gerät und App
 * (fiskalische Begriffe wie „cash register closing“ bleiben), „Server“ für
 * Bedienungen, US-Schreibweise, „Inventory“ (Bereich) und „stocktake“
 * (ein Zähldurchgang).
 */

function strings(lang: 'de' | 'en'): string[] {
  const file = path.join(process.cwd(), 'src', 'messages', `${lang}.json`);
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(JSON.parse(readFileSync(file, 'utf8')));
  return out;
}

const offending = (lang: 'de' | 'en', pattern: RegExp) => strings(lang).filter((s) => pattern.test(s));

test.describe('wording', () => {
  test('German uses „Kassenlade“ and „Rechnung teilen“', () => {
    expect(offending('de', /Kassenschublade|Schublade öffnen|Rechnung splitten/)).toEqual([]);
  });

  test('English uses till for the device, Server, US spelling and Inventory', () => {
    expect(offending('en', /\b(at|on) the register\b|\bthis register\b|\bAll registers\b|\bLock register\b/)).toEqual([]);
    expect(offending('en', /\b(the|The|At the|at the|on the) POS\b(?! (device|terminal))/)).toEqual([]);
    expect(offending('en', /\bWaiters?\b|\bwaiter exists\b/)).toEqual([]);
    expect(offending('en', /Customis|Colour|colour|organisation|recognis|greyed/)).toEqual([]);
    // Bereich „Inventory“, ein einzelner Zähldurchgang „stocktake“ (wie in der Doku).
    expect(offending('en', /Stocktaking|inventory count|stock count/)).toEqual([]);
  });
});

test.describe('0 % label per context', () => {
  test('VAT-liable German organizations: 0 % is "not taxable" (DSFinV-K key 5)', () => {
    expect(taxRatesFor('DE', false).find((o) => o.rate === 0)?.labelKey).toBe('zeroNotTaxable');
  });

  test('organizations without VAT (small business, § 19 UStG): 0 % is "tax-exempt" (key 6)', () => {
    expect(taxRatesFor('DE', true)).toEqual([{ rate: 0, labelKey: 'zero' }]);
    expect(taxRatesFor('AT', false)).toEqual([{ rate: 0, labelKey: 'zero' }]);
  });
});
