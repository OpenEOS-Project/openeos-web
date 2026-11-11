import { expect, test } from '@playwright/test';

import { summaryRows } from '@/lib/dsfinvk';
import {
  distinctRates,
  formatRate,
  formatTokenCount,
  lockedTokenFields,
  multiPurposeTokenNote,
  normalizeTokenApiError,
  restrictedProducts,
  signedTransactionAmount,
  singlePurposeAvailable,
  singlePurposeRates,
  tokenKindBadge,
  tokenLinesLabel,
  tokenReportCsvRows,
  tokenRowHasMovement,
  tokensUnavailableReason,
  tokenTypeFormDefaults,
  tokenTypePayload,
  validateTokenTypeForm,
  vatHasSinglePurposeTokens,
  type TokenTypeFormValues,
} from '@/lib/token-admin';
import { ApiException } from '@/types/api';
import type { TokenType } from '@/types/token';

/*
 * Wertmarken in der Verwaltung (Steuerberater 2026-11-10, Frage 13):
 * Mehrzweck (Standard) vs. Einzweck (nur ein Steuersatz, nicht als
 * Kleinunternehmer); die Prüfung spiegelt token-types.service.ts der API.
 */

const zero = { count: 0, amount: 0 };

function values(overrides: Partial<TokenTypeFormValues> = {}): TokenTypeFormValues {
  return { ...tokenTypeFormDefaults(), name: '2-€-Marke', value: 2, ...overrides };
}

const products = [
  { id: 'beer', categoryId: 'drinks', taxRate: 19 },
  { id: 'cola', categoryId: 'drinks', taxRate: '19.00' },
  { id: 'sausage', categoryId: 'food', taxRate: 7 },
  { id: 'fries', categoryId: 'food', taxRate: 7 },
];

test.describe('operating mode', () => {
  test('tokens only in "All features" (DE with cloud TSE)', () => {
    expect(tokensUnavailableReason({ mode: 'full', tokensAllowed: true })).toBeNull();
    expect(tokensUnavailableReason({ mode: 'orders_only', tokensAllowed: false })).toBe('ordersOnly');
    expect(tokensUnavailableReason({ mode: 'cashless', tokensAllowed: false })).toBe('cashless');
    expect(tokensUnavailableReason({ mode: 'full', tokensAllowed: false })).toBe('tseRequired');
  });
});

test.describe('kind rules', () => {
  test('single-purpose only with VAT rates > 0, never as small business', () => {
    expect(singlePurposeRates('DE', false)).toEqual([19, 7]);
    expect(singlePurposeRates('DE', true)).toEqual([]);
    expect(singlePurposeRates('DE', undefined)).toEqual([]);
    expect(singlePurposeAvailable('de', false)).toBe(true);
    expect(singlePurposeAvailable('AT', false)).toBe(false);
  });

  test('kind badge', () => {
    expect(tokenKindBadge({ kind: 'multi_purpose', vatRate: null })).toEqual({ key: 'multi', rate: null });
    expect(tokenKindBadge({ kind: 'single_purpose', vatRate: '19.00' })).toEqual({ key: 'single', rate: 19 });
    expect(formatRate(19, 'de')).toBe('19 %');
    expect(formatRate(5.5, 'de')).toBe('5,5 %');
    expect(formatRate(5.5, 'en')).toBe('5.5 %');
  });

  test('locked fields once tokens are in circulation', () => {
    expect(lockedTokenFields(null)).toEqual({ value: false, kind: false, vatRate: false, restriction: false });
    expect(lockedTokenFields({ inUse: true, kind: 'multi_purpose' })).toEqual({
      value: true,
      kind: true,
      vatRate: true,
      restriction: false,
    });
    expect(lockedTokenFields({ inUse: true, kind: 'single_purpose' }).restriction).toBe(true);
  });
});

test.describe('form validation', () => {
  test('a plain multi-purpose token is valid', () => {
    expect(validateTokenTypeForm(values(), { vatExempt: true })).toEqual([]);
  });

  test('name and face value', () => {
    expect(validateTokenTypeForm(values({ name: '  ' }), { vatExempt: true })).toEqual([
      { field: 'name', error: 'nameRequired' },
    ]);
    expect(validateTokenTypeForm(values({ name: 'x'.repeat(101) }), { vatExempt: true })[0].error).toBe('nameTooLong');
    for (const value of [0, -1, 1000.01, 1.005]) {
      expect(validateTokenTypeForm(values({ value }), { vatExempt: true })).toEqual([
        { field: 'value', error: 'valueRange' },
      ]);
    }
    expect(validateTokenTypeForm(values({ value: 1000 }), { vatExempt: true })).toEqual([]);
    expect(validateTokenTypeForm(values({ value: 0.01 }), { vatExempt: true })).toEqual([]);
  });

  test('categories and items need an event', () => {
    expect(
      validateTokenTypeForm(values({ allowedCategoryIds: ['drinks'] }), { vatExempt: false }),
    ).toEqual([{ field: 'restriction', error: 'restrictionRequiresEvent' }]);
  });

  test('single-purpose: small business, rate required', () => {
    expect(validateTokenTypeForm(values({ kind: 'single_purpose', vatRate: 19 }), { vatExempt: true })).toEqual([
      { field: 'kind', error: 'smallBusiness' },
    ]);
    expect(validateTokenTypeForm(values({ kind: 'single_purpose', vatRate: null }), { vatExempt: false })).toEqual([
      { field: 'vatRate', error: 'rateRequired' },
    ]);
    expect(validateTokenTypeForm(values({ kind: 'single_purpose', vatRate: 0 }), { vatExempt: false })).toEqual([
      { field: 'vatRate', error: 'rateRequired' },
    ]);
    // Ohne Auswahl gilt die Marke für alle Artikel mit ihrem Satz.
    expect(validateTokenTypeForm(values({ kind: 'single_purpose', vatRate: 19 }), { vatExempt: false })).toEqual([]);
  });

  test('single-purpose: all selected items must share the rate', () => {
    const drinks = values({ kind: 'single_purpose', vatRate: 19, eventId: 'e1', allowedCategoryIds: ['drinks'] });
    expect(validateTokenTypeForm(drinks, { vatExempt: false, products })).toEqual([]);

    const mixed = { ...drinks, allowedProductIds: ['sausage'] };
    expect(validateTokenTypeForm(mixed, { vatExempt: false, products })).toEqual([
      { field: 'restriction', error: 'mixedRates', rates: [19, 7], rate: 19 },
    ]);

    const wrongRate = { ...drinks, vatRate: 7 };
    expect(validateTokenTypeForm(wrongRate, { vatExempt: false, products })[0]).toMatchObject({
      error: 'mixedRates',
      rates: [19],
      rate: 7,
    });

    const empty = { ...drinks, allowedCategoryIds: ['merch'] };
    expect(validateTokenTypeForm(empty, { vatExempt: false, products })).toEqual([
      { field: 'restriction', error: 'noProducts' },
    ]);
    // Artikel laden noch: keine Satzprüfung (die API prüft).
    expect(validateTokenTypeForm(mixed, { vatExempt: false, products: null })).toEqual([]);
  });

  test('restricted products and distinct rates', () => {
    expect(restrictedProducts(products, ['food'], ['beer', 'sausage']).map((p) => p.id)).toEqual([
      'beer',
      'sausage',
      'fries',
    ]);
    expect(distinctRates(products)).toEqual([19, 7]);
  });
});

test.describe('payload', () => {
  test('multi-purpose has no rate; no event means no selection', () => {
    const payload = tokenTypePayload(
      values({ name: ' 2-€-Marke ', vatRate: 19, allowedCategoryIds: ['drinks'], sortOrder: 2.6 }),
    );
    expect(payload).toEqual({
      name: '2-€-Marke',
      value: 2,
      kind: 'multi_purpose',
      vatRate: null,
      eventId: null,
      allowedCategoryIds: [],
      allowedProductIds: [],
      color: '#f59e0b',
      buybackAllowed: false,
      isActive: true,
      sortOrder: 3,
    });
  });

  test('single-purpose keeps rate and selection', () => {
    const payload = tokenTypePayload(
      values({
        kind: 'single_purpose',
        vatRate: 19,
        eventId: 'e1',
        allowedCategoryIds: ['drinks', 'drinks'],
        allowedProductIds: ['beer'],
        buybackAllowed: true,
      }),
    );
    expect(payload).toMatchObject({
      kind: 'single_purpose',
      vatRate: 19,
      eventId: 'e1',
      allowedCategoryIds: ['drinks'],
      allowedProductIds: ['beer'],
      buybackAllowed: true,
    });
  });

  test('form defaults from an existing type (decimals as text)', () => {
    const type = {
      id: 't1',
      organizationId: 'o1',
      eventId: 'e1',
      name: 'Getränkemarke',
      value: '2.50',
      kind: 'single_purpose',
      vatRate: '19.00',
      allowedCategoryIds: ['drinks'],
      allowedProductIds: [],
      color: null,
      buybackAllowed: true,
      isActive: false,
      sortOrder: 4,
      inUse: true,
    } satisfies TokenType;
    expect(tokenTypeFormDefaults(type)).toEqual({
      name: 'Getränkemarke',
      value: 2.5,
      kind: 'single_purpose',
      vatRate: 19,
      eventId: 'e1',
      allowedCategoryIds: ['drinks'],
      allowedProductIds: [],
      color: null,
      buybackAllowed: true,
      isActive: false,
      sortOrder: 4,
    });
  });
});

test.describe('API errors', () => {
  test('mixed rates: the list becomes text for the translation', () => {
    const error = new ApiException('VALIDATION_ERROR', 'x', 400, undefined, 'TOKEN_SINGLE_PURPOSE_MIXED_RATES', {
      rates: [19, 7] as unknown as number,
      rate: 19,
    });
    const normalized = normalizeTokenApiError(error, 'de') as ApiException;
    expect(normalized).toBeInstanceOf(ApiException);
    expect(normalized.reason).toBe('TOKEN_SINGLE_PURPOSE_MIXED_RATES');
    expect(normalized.params).toEqual({ rates: '19 %, 7 %', rate: 19 });
  });

  test('other errors stay untouched', () => {
    const error = new ApiException('CONFLICT', 'x', 409, undefined, 'TOKEN_TYPE_LOCKED');
    expect(normalizeTokenApiError(error, 'de')).toBe(error);
    const plain = new Error('boom');
    expect(normalizeTokenApiError(plain, 'de')).toBe(plain);
  });
});

test.describe('report formatting', () => {
  test('counts and lines', () => {
    expect(formatTokenCount(12, 'de')).toBe('12');
    expect(formatTokenCount(1234, 'de')).toBe('1.234');
    expect(formatTokenCount(0.5, 'de')).toBe('0,5');
    expect(
      tokenLinesLabel(
        [
          { count: 9, name: '2-€-Marke' },
          { count: -1, name: '5-€-Marke' },
        ],
        'de',
      ),
    ).toBe('9 × 2-€-Marke, 1 × 5-€-Marke');
  });

  test('buybacks are negative', () => {
    expect(signedTransactionAmount({ kind: 'sale', totalAmount: '20.00' })).toBe(20);
    expect(signedTransactionAmount({ kind: 'buyback', totalAmount: '6.00' })).toBe(-6);
    expect(signedTransactionAmount({ kind: 'buyback', totalAmount: -6 })).toBe(-6);
    expect(Object.is(signedTransactionAmount({ kind: 'buyback', totalAmount: 0 }), -0)).toBe(false);
  });

  test('movement and CSV rows', () => {
    const row = {
      name: '2-€-Marke',
      sold: { count: 10, amount: 20 },
      redeemed: { count: 9, amount: 18 },
      returned: zero,
      boughtBack: zero,
      outstanding: { count: 1, amount: 2 },
    };
    expect(tokenRowHasMovement(row)).toBe(true);
    expect(
      tokenRowHasMovement({ sold: zero, redeemed: zero, returned: zero, boughtBack: zero, outstanding: zero }),
    ).toBe(false);
    expect(tokenReportCsvRows([row], { ...row, name: 'Summe' })).toEqual([
      ['2-€-Marke', 10, 20, 9, 18, 0, 0, 0, 0, 1, 2],
      ['Summe', 10, 20, 9, 18, 0, 0, 0, 0, 1, 2],
    ]);
  });
});

test.describe('VAT report', () => {
  const row = { rate: 19, goods: 100, deposits: 0, depositReturns: 0, gross: 100, tax: 15.97, net: 84.03 };

  test('single-purpose column only when a row has an amount', () => {
    expect(vatHasSinglePurposeTokens({ rows: [row] })).toBe(false);
    expect(vatHasSinglePurposeTokens({ rows: [{ ...row, singlePurposeTokens: 0 }] })).toBe(false);
    expect(vatHasSinglePurposeTokens({ rows: [{ ...row, singlePurposeTokens: -4 }] })).toBe(true);
    expect(vatHasSinglePurposeTokens(undefined)).toBe(false);
  });

  test('multi-purpose note (not taxable), buybacks as positive amount', () => {
    expect(multiPurposeTokenNote({})).toBeNull();
    expect(multiPurposeTokenNote({ multiPurposeTokens: { sold: 0, boughtBack: 0 } })).toBeNull();
    expect(multiPurposeTokenNote({ multiPurposeTokens: { sold: 50, boughtBack: -6 } })).toEqual({
      sold: 50,
      boughtBack: 6,
    });
  });
});

test.describe('cashbook', () => {
  const base = {
    openingBalance: 100,
    deposits: 0,
    withdrawals: 0,
    cashSales: 40,
    cashRefunds: 0,
    pfandPayouts: 0,
    tipPayouts: 0,
    differences: 0,
    expected: 140,
    lastCount: null,
  };

  test('token rows only when there is a movement', () => {
    expect(summaryRows(base).some((r) => r.key === 'tokenSales' || r.key === 'tokenBuybacks')).toBe(false);
    expect(summaryRows({ ...base, tokenSales: 0, tokenBuybacks: 0 }).some((r) => r.key === 'tokenSales')).toBe(false);
    const rows = summaryRows({ ...base, tokenSales: 20, tokenBuybacks: -6 });
    expect(rows.find((r) => r.key === 'tokenSales')?.value).toBe(20);
    expect(rows.find((r) => r.key === 'tokenBuybacks')?.value).toBe(-6);
    // Vor den Differenzen, nach den Auszahlungen.
    const keys = rows.map((r) => r.key);
    expect(keys.indexOf('tokenSales')).toBe(keys.indexOf('tipPayouts') + 1);
    expect(keys.indexOf('differences')).toBe(keys.indexOf('tokenBuybacks') + 1);
  });
});
