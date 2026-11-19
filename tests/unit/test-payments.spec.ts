import { expect, test } from '@playwright/test';

import de from '../../src/messages/de.json';
import en from '../../src/messages/en.json';
import { batchPaymentFields, cashChangeOf, paymentMethodOf } from '@/app/[locale]/device/pos/utils/pay-result';
import { isTestPaymentMethod } from '@/types/payment';
import type { OrderDetail } from '@/types/order-history';
import { shouldOpenCashDrawer } from '@/utils/cash-drawer';
import { paymentIcon, paymentKey } from '@/utils/order-history';
import { initialPayMethod, isTestPayMethod, testCheckout } from '@/utils/pos-card-mode';
import { refundMethod } from '@/utils/refund-form';

/*
 * Testzahlungen („Bar (Test)“, „Karte (Test)“): im Testmodus in jeder
 * Betriebsart außer „Nur Bons“ — auch ohne Bargeld, TSE oder SumUp. Kein
 * Geld, keine Kassenlade; die API nimmt sie nur für Testbestellungen an.
 */

test.describe('test checkout', () => {
  test('follows the orders, falls back to the event phase', () => {
    expect(testCheckout([], true)).toBe(true);
    expect(testCheckout([], false)).toBe(false);
    expect(testCheckout([{ isTest: true }, { isTest: true }], false)).toBe(true);
    // Echte Bestellung dabei: echte Zahlarten (die API nähme Test nicht an).
    expect(testCheckout([{ isTest: true }, { isTest: false }], true)).toBe(false);
    expect(testCheckout([{ isTest: false }], true)).toBe(false);
    expect(testCheckout([{}, { isTest: null }], true)).toBe(true);
  });

  test('starts with „Bar (Test)“ — even cashless, without card and without vouchers', () => {
    for (const cashless of [false, true]) {
      for (const card of [null, 'manual', 'sumup', 'sumup_test'] as const) {
        expect(initialPayMethod({ cashless, card, hasVouchers: false, testMode: true })).toBe('test_cash');
      }
    }
    // Ohne Testmodus wie bisher: bargeldlos ohne Karte keine Zahlart.
    expect(initialPayMethod({ cashless: true, card: null, hasVouchers: false })).toBeNull();
    expect(initialPayMethod({ cashless: false, card: null, hasVouchers: false })).toBe('cash');
  });

  test('maps to the API methods test_cash/test_card, without received cash', () => {
    expect(paymentMethodOf({ method: 'test_cash' })).toBe('test_cash');
    expect(paymentMethodOf({ method: 'test_card' })).toBe('test_card');
    expect(paymentMethodOf({ method: 'cash' })).toBe('cash');
    expect(batchPaymentFields({ method: 'test_cash', amountReceived: 20, tip: 0 })).toEqual({ paymentMethod: 'test_cash' });
    expect(batchPaymentFields({ method: 'test_card', tip: 0 })).toEqual({ paymentMethod: 'test_card' });
    // Rückgeld nur zur Anzeige (Übung), gebucht wird es nicht.
    expect(cashChangeOf({ method: 'test_cash', amountReceived: 20, tip: 0 }, 12.5)).toBe(7.5);
    expect(isTestPayMethod('test_card')).toBe(true);
    expect(isTestPayMethod('card')).toBe(false);
    expect(isTestPaymentMethod('test_cash')).toBe(true);
    expect(isTestPaymentMethod('cash')).toBe(false);
  });

  test('never opens the cash drawer', () => {
    const base = {
      open: true,
      amount: 10,
      cashless: false,
      settings: { cashDrawerPrinterId: 'printer-1' },
      alreadyOpened: false,
    };
    expect(shouldOpenCashDrawer({ ...base, method: 'cash' })).toBe(true);
    expect(shouldOpenCashDrawer({ ...base, method: 'test_cash' })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, method: 'test_card' })).toBe(false);
  });

  test('is shown as test payment and refunded only as test', () => {
    expect(paymentKey('test_cash')).toBe('test_cash');
    expect(paymentKey('test_card')).toBe('test_card');
    expect(paymentIcon('test_cash')).toBe('cash');
    for (const messages of [de, en]) {
      for (const key of ['test_cash', 'test_card'] as const) {
        expect(messages.orders.history.payment[key]).toBeTruthy();
        expect(messages.pos.orderHistory.payment[key]).toBeTruthy();
        expect(messages.pos.done.method[key]).toBeTruthy();
      }
      expect(messages.apiErrors.TEST_PAYMENT_REQUIRES_TEST_ORDER).toBeTruthy();
      for (const key of ['testCash', 'testCard', 'testHint', 'testTitle', 'testCashText', 'testComplete', 'testCardBook', 'testCardTitle', 'testCardText'] as const) {
        expect(messages.pos.pay[key], key).toBeTruthy();
      }
    }
    expect(de.pos.pay.testCash).toBe('Bar (Test)');
    expect(de.pos.pay.testCard).toBe('Karte (Test)');
    const order = { isTest: true } as Pick<OrderDetail, 'isTest'>;
    expect(refundMethod(order, { paymentMethod: 'test_cash' })).toBe('test');
    expect(refundMethod(order, { paymentMethod: 'test_card' })).toBe('test');
    // Selbst wenn eine Bestellung nicht (mehr) als Test markiert wäre: nie Bargeld.
    expect(refundMethod({ isTest: false }, { paymentMethod: 'test_cash' })).toBe('test');
  });
});
