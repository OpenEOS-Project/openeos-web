import { expect, test } from '@playwright/test';

import { resolveOrderingMode } from '@/utils/ordering-mode';

test.describe('resolveOrderingMode', () => {
  test('nimmt den Wert der Veranstaltung', () => {
    expect(resolveOrderingMode({ orderingMode: 'immediate' }, { pos: { orderingMode: 'tab' } })).toBe('immediate');
    expect(resolveOrderingMode({ orderingMode: 'tab' }, null)).toBe('tab');
  });

  test('fällt ohne eigenen Wert auf die Organisation zurück', () => {
    expect(resolveOrderingMode({}, { pos: { orderingMode: 'tab' } })).toBe('tab');
    expect(resolveOrderingMode(null, { pos: { orderingMode: 'tab' } })).toBe('tab');
  });

  test('ohne Angaben oder bei unbekannten Werten: sofort kassieren', () => {
    expect(resolveOrderingMode(undefined, undefined)).toBe('immediate');
    expect(resolveOrderingMode({ orderingMode: null }, { pos: null })).toBe('immediate');
    expect(resolveOrderingMode({ orderingMode: 'bogus' }, null)).toBe('immediate');
  });
});
