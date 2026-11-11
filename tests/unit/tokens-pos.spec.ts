import { expect, test } from '@playwright/test';

import { batchPaymentFields, cashChangeOf } from '@/app/[locale]/device/pos/utils/pay-result';
import { isTokensAllowed, resolveOperatingMode } from '@/lib/operating-mode';
import { tokenTenders, tokensValueCents, type TokenType } from '@/types/token';
import { paymentBadges, paymentIcon, paymentKey } from '@/utils/order-history';
import { paymentRefundable } from '@/utils/refund-form';

/*
 * Wertmarken an der Kasse: wann sie angeboten werden (Betriebsart, TSE),
 * Wert der Marken, Felder der Sammelzahlung (Rest bar/Karte, nur Marken,
 * Überschuss als Trinkgeld), Rückgeld und Verlauf.
 */

function type(id: string, value: number | string, extra: Partial<TokenType> = {}): TokenType {
  return {
    id,
    organizationId: 'org',
    eventId: null,
    name: id,
    value,
    kind: 'multi_purpose',
    vatRate: null,
    allowedCategoryIds: [],
    allowedProductIds: [],
    color: null,
    buybackAllowed: false,
    isActive: true,
    sortOrder: 0,
    ...extra,
  };
}

test.describe('tokens: operating mode', () => {
  test('only „Alle Funktionen“; Germany only with an active TSE, also for legacy orgs', () => {
    expect(isTokensAllowed({ country: 'DE', operatingMode: 'full' })).toBe(false);
    expect(isTokensAllowed({ country: 'DE', operatingMode: 'full', operatingModeLegacy: true })).toBe(false);
    expect(isTokensAllowed({ country: 'DE', operatingMode: 'full', tseActive: true })).toBe(true);
    expect(isTokensAllowed({ country: 'AT', operatingMode: 'full' })).toBe(true);
    expect(isTokensAllowed({ country: 'AT', operatingMode: 'cashless' })).toBe(false);
    expect(isTokensAllowed({ country: 'DE', operatingMode: 'orders_only', tseActive: true })).toBe(false);
    expect(isTokensAllowed(null)).toBe(false);
  });

  test('the server value wins', () => {
    expect(isTokensAllowed({ country: 'DE', operatingMode: 'full', tokensAllowed: true })).toBe(true);
    expect(resolveOperatingMode({ country: 'AT', operatingMode: 'full', tokensAllowed: false }).tokensAllowed).toBe(
      false,
    );
  });
});

test.describe('tokens: value and tenders', () => {
  test('sums in cents and drops empty counts', () => {
    const types = [type('a', '2.00'), type('b', 0.5)];
    expect(tokensValueCents(types, { a: 3, b: 3 })).toBe(750);
    expect(tokensValueCents(types, { a: -1, x: 4 })).toBe(0);
    expect(tokenTenders({ a: 3, b: 0 })).toEqual([{ tokenTypeId: 'a', count: 3 }]);
  });
});

test.describe('tokens: batch payment fields', () => {
  test('tokens plus cash for the rest: change only on the money part', () => {
    const result = {
      method: 'cash' as const,
      amountReceived: 5,
      tip: 0,
      tokens: [{ tokenTypeId: 'a', count: 5 }],
      tokenValue: 10,
    };
    expect(batchPaymentFields(result)).toEqual({
      paymentMethod: 'cash',
      amountReceived: 5,
      tokens: [{ tokenTypeId: 'a', count: 5 }],
    });
    expect(cashChangeOf(result, 14)).toBe(1);
  });

  test('only tokens, excess as tip', () => {
    expect(
      batchPaymentFields({
        method: 'tokens',
        tip: 0,
        tokens: [{ tokenTypeId: 'a', count: 4 }],
        tokenExcessAsTip: true,
        tokenValue: 8,
      }),
    ).toEqual({ paymentMethod: 'tokens', tokens: [{ tokenTypeId: 'a', count: 4 }], tokenExcessAsTip: true });
  });

  test('card and SumUp keep their fields', () => {
    expect(batchPaymentFields({ method: 'sumup', tip: 1, transactionId: 'TX' })).toEqual({
      paymentMethod: 'sumup_terminal',
      tipAmount: 1,
      providerTransactionId: 'TX',
    });
    expect(batchPaymentFields({ method: 'card', tip: 0 })).toEqual({ paymentMethod: 'card' });
  });
});

test.describe('tokens: history and refunds', () => {
  test('token payments get their own label and icon', () => {
    expect(paymentKey('tokens')).toBe('tokens');
    expect(paymentIcon('tokens')).toBe('ticket');
    expect(paymentBadges({ paymentMethods: ['cash', 'tokens'], discountAmount: 0 }).map((b) => b.key)).toEqual([
      'cash',
      'tokens',
    ]);
  });

  test('refundable over a payment = money plus tokens (tokens go back as tokens)', () => {
    expect(paymentRefundable({ refundable: 1, tokenRefundable: 6 })).toBe(7);
    expect(paymentRefundable({ refundable: 2.5 })).toBe(2.5);
  });
});
