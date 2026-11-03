import { checkoutIncludesTse, checkoutTseSurcharge } from '@/utils/event-tse';
import { expect, test } from '@playwright/test';

import type { EventTseTerms } from '@/types/billing';

function terms(overrides: Partial<EventTseTerms> = {}): EventTseTerms {
  return {
    offer: 'included',
    surcharge: 0,
    missing: [],
    included: null,
    surchargeCharged: null,
    ...overrides,
  };
}

test.describe('Cloud-TSE im Bezahldialog', () => {
  test('„Alle Funktionen“ (DE): TSE gehört immer dazu, Zuschlag nur wenn eingestellt', () => {
    expect(checkoutIncludesTse(terms(), null)).toBe(true);
    expect(checkoutTseSurcharge(terms(), null)).toBe(0);
    expect(checkoutTseSurcharge(terms({ surcharge: 4.5 }), null)).toBe(4.5);
  });

  test('Bestand: nur mit „Ja“', () => {
    const optional = terms({ offer: 'optional', surcharge: 4.5 });
    expect(checkoutIncludesTse(optional, null)).toBe(false);
    expect(checkoutIncludesTse(optional, false)).toBe(false);
    expect(checkoutIncludesTse(optional, true)).toBe(true);
    expect(checkoutTseSurcharge(optional, false)).toBe(0);
    expect(checkoutTseSurcharge(optional, true)).toBe(4.5);
  });

  test('ohne TSE-Angebot (Bargeldlos, AT, ältere API) nichts', () => {
    expect(checkoutIncludesTse(terms({ offer: null, surcharge: 4.5 }), true)).toBe(false);
    expect(checkoutTseSurcharge(undefined, true)).toBe(0);
  });
});
