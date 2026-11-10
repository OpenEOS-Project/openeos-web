import { expect, test } from '@playwright/test';

import { isVatStatusClosingError, smallBusinessNotice, vatStatusNeedsClosing } from '@/lib/vat-status';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import { ApiException } from '@/types/api';
import type { SmallBusinessStatus } from '@/types/report';

const status = (extra: Partial<SmallBusinessStatus> = {}): SmallBusinessStatus => ({
  vatExempt: true,
  year: 2026,
  currentYearRevenue: 0,
  previousYearRevenue: 0,
  limitCurrentYear: 100000,
  limitPreviousYear: 25000,
  ratio: 0,
  warning: null,
  ...extra,
});

test.describe('Steuerstatus: Wechsel mit Cloud-TSE', () => {
  test('needs the closing flow once a TSE exists or existed', () => {
    expect(vatStatusNeedsClosing(null)).toBe(false);
    expect(vatStatusNeedsClosing({ tseActive: false, tse: null })).toBe(false);
    expect(vatStatusNeedsClosing({ tseActive: true })).toBe(true);
    const summary = { available: true, integrationEnabled: true, active: false, serialNumber: null, clientId: null };
    expect(vatStatusNeedsClosing({ tse: { ...summary, state: 'active' } })).toBe(true);
    expect(vatStatusNeedsClosing({ tse: { ...summary, state: 'deactivated' } })).toBe(true);
    expect(vatStatusNeedsClosing({ tse: { ...summary, state: 'creating' } })).toBe(false);
    expect(vatStatusNeedsClosing({ tse: { ...summary, state: null } })).toBe(false);
  });

  test('recognizes the 409 of the plain switch', () => {
    const conflict = new ApiException('CONFLICT', 'x', 409, undefined, 'VAT_STATUS_CHANGE_REQUIRES_CLOSING');
    expect(isVatStatusClosingError(conflict)).toBe(true);
    expect(isVatStatusClosingError(new ApiException('CONFLICT', 'x', 409))).toBe(false);
    expect(isVatStatusClosingError(new Error('x'))).toBe(false);
    expect(de.apiErrors.VAT_STATUS_CHANGE_REQUIRES_CLOSING).toBeTruthy();
    expect(en.apiErrors.VAT_STATUS_CHANGE_REQUIRES_CLOSING).toBeTruthy();
  });
});

test.describe('Kleinunternehmergrenze im Dashboard', () => {
  test('stays silent without warning or when liable for VAT', () => {
    expect(smallBusinessNotice(undefined)).toBeNull();
    expect(smallBusinessNotice(status())).toBeNull();
    expect(smallBusinessNotice(status({ vatExempt: false, warning: 'exceeded' }))).toBeNull();
  });

  test('approaching: share of the 100.000 € limit, rounded down', () => {
    expect(smallBusinessNotice(status({ currentYearRevenue: 84999.99, ratio: 0.85, warning: 'approaching' }))).toEqual({
      kind: 'approaching',
      basis: 'current',
      revenue: 84999.99,
      limit: 100000,
      percent: 84,
    });
  });

  test('exceeded: current year first, otherwise the previous year', () => {
    expect(smallBusinessNotice(status({ currentYearRevenue: 100000.01, warning: 'exceeded' }))).toMatchObject({
      kind: 'exceeded',
      basis: 'current',
      limit: 100000,
    });
    expect(
      smallBusinessNotice(status({ currentYearRevenue: 4000, previousYearRevenue: 26000, warning: 'exceeded' })),
    ).toMatchObject({ kind: 'exceeded', basis: 'previous', revenue: 26000, limit: 25000, percent: 104 });
  });

  test('texts exist in both languages', () => {
    for (const messages of [de, en]) {
      const texts = messages.dashboard.smallBusiness;
      for (const key of ['approaching', 'exceeded', 'exceededPrevious'] as const) {
        expect(texts[key].title).toBeTruthy();
        expect(texts[key].text).toContain('{revenue}');
      }
    }
  });
});
