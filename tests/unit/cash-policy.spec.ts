import { expect, test } from '@playwright/test';

import {
  canSwitchToCountryPolicy,
  cashNoticeKind,
  cashNoticeStorageKey,
  cashPolicyDocsUrl,
  countriesFaqUrl,
  effectiveCashPolicy,
  isCashBlocked,
  isCashBlockedByPolicy,
  offersCloseWithoutPayment,
} from '@/lib/cash-policy';
import { COUNTRY_CODES, PRIORITY_COUNTRIES, countryName, countryOptions, normalizeCountry } from '@/lib/countries';
import { initialPayMethod } from '@/utils/pos-card-mode';

/* Bargeld-Regel je Land: Matrix wie in der API (cash-policy.util.ts). */

const newDe = { country: 'DE', cashPolicyLegacy: false, settings: {} };
const legacyDe = { country: 'DE', cashPolicyLegacy: true, settings: {} };

test.describe('effectiveCashPolicy', () => {
  test('uses the value from the API when present', () => {
    expect(effectiveCashPolicy({ ...newDe, cashPolicy: 'allowed' })).toBe('allowed');
    expect(effectiveCashPolicy({ country: 'AT', cashPolicy: 'blocked_de_no_tse' })).toBe('blocked_de_no_tse');
  });

  test('falls back to country and legacy flag', () => {
    expect(effectiveCashPolicy(newDe)).toBe('blocked_de_no_tse');
    expect(effectiveCashPolicy(legacyDe)).toBe('allowed');
    expect(effectiveCashPolicy({ country: 'AT', cashPolicyLegacy: false })).toBe('allowed');
    expect(effectiveCashPolicy({ country: 'CH', cashPolicyLegacy: false })).toBe('allowed');
    expect(effectiveCashPolicy({ country: 'IT', cashPolicyLegacy: false })).toBe('allowed');
    expect(effectiveCashPolicy({ country: null, cashPolicyLegacy: false })).toBe('allowed');
    expect(effectiveCashPolicy(null)).toBe('allowed');
  });

  test('blocked = policy or cashless switch', () => {
    expect(isCashBlockedByPolicy(newDe)).toBe(true);
    expect(isCashBlocked(newDe)).toBe(true);
    expect(isCashBlocked(legacyDe)).toBe(false);
    expect(isCashBlocked({ ...legacyDe, settings: { payments: { cashless: true } } })).toBe(true);
    expect(isCashBlockedByPolicy({ ...legacyDe, settings: { payments: { cashless: true } } })).toBe(false);
  });
});

test.describe('cashNoticeKind', () => {
  test('asks for the country first', () => {
    expect(cashNoticeKind({ country: null, cashPolicyLegacy: true })).toBe('set_country');
    expect(cashNoticeKind({ country: '', cashPolicyLegacy: false })).toBe('set_country');
  });

  test('per country', () => {
    expect(cashNoticeKind(legacyDe)).toBe('de_legacy');
    expect(cashNoticeKind(newDe)).toBe('de_blocked');
    expect(cashNoticeKind({ country: 'DE', cashPolicyLegacy: false, cashPolicy: 'allowed' })).toBeNull();
    expect(cashNoticeKind({ country: 'AT', cashPolicyLegacy: true })).toBe('at');
    expect(cashNoticeKind({ country: 'CH', cashPolicyLegacy: false })).toBe('ch');
    expect(cashNoticeKind({ country: 'FR', cashPolicyLegacy: false })).toBe('other');
  });

  test('order-only mode: only the country request', () => {
    const settings = { operatingMode: 'order_only' };
    expect(cashNoticeKind({ ...newDe, settings })).toBeNull();
    expect(cashNoticeKind({ country: 'AT', settings })).toBeNull();
    expect(cashNoticeKind({ country: null, settings })).toBe('set_country');
  });

  test('switch is offered to legacy organizations in Germany only', () => {
    expect(canSwitchToCountryPolicy(legacyDe)).toBe(true);
    expect(canSwitchToCountryPolicy(newDe)).toBe(false);
    expect(canSwitchToCountryPolicy({ country: 'AT', cashPolicyLegacy: true })).toBe(false);
  });

  test('close without payment only for "Germany without cash", not in order-only', () => {
    expect(offersCloseWithoutPayment(newDe)).toBe(true);
    expect(offersCloseWithoutPayment(legacyDe)).toBe(false);
    expect(offersCloseWithoutPayment({ ...newDe, settings: { operatingMode: 'order_only' } })).toBe(false);
  });

  test('dismissal is stored per user, organization and kind', () => {
    expect(cashNoticeStorageKey('u1', 'o1', 'at')).toBe('openeos-cash-notice-dismissed:u1:o1:at');
    expect(cashNoticeStorageKey('u1', 'o1', 'at')).not.toBe(cashNoticeStorageKey('u1', 'o1', 'set_country'));
  });

  test('links per language', () => {
    expect(cashPolicyDocsUrl('de')).toBe('https://docs.openeos.de/land-und-bargeld');
    expect(cashPolicyDocsUrl('en')).toBe('https://docs.openeos.de/en/land-und-bargeld');
    expect(countriesFaqUrl('de')).toBe('https://openeos.de/faq#laender');
  });
});

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

test.describe('initialPayMethod with close without payment', () => {
  test('card first, then close without payment', () => {
    expect(initialPayMethod({ cashless: true, card: 'sumup', hasVouchers: false, outside: true })).toBe('card');
    expect(initialPayMethod({ cashless: true, card: null, hasVouchers: true, outside: true })).toBe('outside');
    expect(initialPayMethod({ cashless: true, card: 'sumup_test', hasVouchers: false, outside: true })).toBe('outside');
    expect(initialPayMethod({ cashless: false, card: null, hasVouchers: false, outside: true })).toBe('cash');
  });
});
