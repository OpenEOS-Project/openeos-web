import { cashlessSwitchStep, isCashlessMode, tseFaqUrl } from '@/lib/cashless';
import { initialPayMethod, resolvePosCardMode } from '@/utils/pos-card-mode';
import { initialRefundState, refundFormView } from '@/utils/refund-form';
import { expect, test } from '@playwright/test';

import type { OrderDetail, OrderDetailPayment } from '@/types/order-history';

/*
 * Bargeldloser Modus: Erkennung, erste Zahlart im Kassieren-Blatt,
 * Kartenmodus im Testmodus und Erstattung nur auf unbare Zahlungen.
 */

function payment(id: string, method: string, refundable: number, createdAt: string): OrderDetailPayment {
  return {
    id,
    amount: refundable,
    paymentMethod: method,
    paymentProvider: method === 'cash' ? 'CASH' : 'CARD',
    status: 'captured',
    refundedAmount: 0,
    refundable,
    createdAt,
  } as unknown as OrderDetailPayment;
}

function order(payments: OrderDetailPayment[]): OrderDetail {
  const refundable = payments.reduce((s, p) => s + p.refundable, 0);
  return {
    id: 'o1',
    dailyNumber: 1,
    isTest: false,
    total: refundable,
    paidAmount: refundable,
    refundable,
    items: [],
    payments,
    refunds: [],
  } as unknown as OrderDetail;
}

test.describe('cashless mode', () => {
  test('only an explicit true counts', () => {
    expect(isCashlessMode(undefined)).toBe(false);
    expect(isCashlessMode({})).toBe(false);
    expect(isCashlessMode({ payments: {} })).toBe(false);
    expect(isCashlessMode({ payments: { cashless: true } })).toBe(true);
  });

  test('switching on saves right away', () => {
    expect(cashlessSwitchStep(false, { type: 'toggle', checked: true })).toEqual({ confirmOff: false, save: true });
  });

  test('switching off asks first and sends nothing yet', () => {
    expect(cashlessSwitchStep(false, { type: 'toggle', checked: false })).toEqual({ confirmOff: true, save: null });
  });

  test('cancelling the question keeps cashless mode on and sends nothing', () => {
    const asked = cashlessSwitchStep(false, { type: 'toggle', checked: false });
    expect(cashlessSwitchStep(asked.confirmOff, { type: 'cancel' })).toEqual({ confirmOff: false, save: null });
  });

  test('confirming allows cash; the question stays open until saved', () => {
    const asked = cashlessSwitchStep(false, { type: 'toggle', checked: false });
    expect(cashlessSwitchStep(asked.confirmOff, { type: 'confirm' })).toEqual({ confirmOff: true, save: false });
    // Ohne offene Rückfrage bewirkt eine Bestätigung nichts.
    expect(cashlessSwitchStep(false, { type: 'confirm' })).toEqual({ confirmOff: false, save: null });
  });

  test('FAQ link per language', () => {
    expect(tseFaqUrl('de')).toBe('https://openeos.de/faq#tse');
    expect(tseFaqUrl('en')).toBe('https://openeos.de/en/faq#tse');
  });

  test('pay sheet starts with cash, cashless with the card', () => {
    expect(initialPayMethod({ cashless: false, card: 'sumup', hasVouchers: true })).toBe('cash');
    expect(initialPayMethod({ cashless: true, card: 'sumup', hasVouchers: true })).toBe('card');
    expect(initialPayMethod({ cashless: true, card: 'manual', hasVouchers: false })).toBe('card');
    expect(initialPayMethod({ cashless: true, card: 'sumup_test', hasVouchers: true })).toBe('discount');
    expect(initialPayMethod({ cashless: true, card: null, hasVouchers: false })).toBeNull();
  });

  test('test mode without cash books the card manually', () => {
    expect(resolvePosCardMode({ readerLinked: true, sumupEnabled: true, isTest: true, cashless: true })).toBe(
      'manual'
    );
    expect(resolvePosCardMode({ readerLinked: true, sumupEnabled: true, isTest: false, cashless: true })).toBe(
      'sumup'
    );
    expect(resolvePosCardMode({ readerLinked: false, sumupEnabled: true, isTest: true, cashless: true })).toBeNull();
  });

  test('refunds only go back to non-cash payments', () => {
    const o = order([
      payment('cash-1', 'cash', 10, '2026-10-08T10:00:00Z'),
      payment('card-1', 'sumup_terminal', 6, '2026-10-08T10:05:00Z'),
    ]);
    const state = initialRefundState(o, { mode: 'amount', cancelItems: false }, { cashless: true });
    // Nur die Kartenzahlung bleibt übrig — sie ist gleich gewählt.
    expect(state.paymentId).toBe('card-1');
    const view = refundFormView(o, { ...state, amount: '5', reasonCode: 'other' }, { cashless: true });
    expect(view.payments.map((p) => p.id)).toEqual(['card-1']);
    expect(view.maxAmount).toBe(6);
    expect(view.cashBlocked).toBe(false);
    expect(view.ready).toBe(true);
    // Mehr als die Karte hergibt: ungültiger Betrag.
    expect(refundFormView(o, { ...state, amount: '8', reasonCode: 'other' }, { cashless: true }).amountInvalid).toBe(
      true
    );
  });

  test('a full refund that needs cash is blocked', () => {
    const o = order([
      payment('cash-1', 'cash', 10, '2026-10-08T10:00:00Z'),
      payment('card-1', 'card', 6, '2026-10-08T10:05:00Z'),
    ]);
    const base = { ...initialRefundState(o, { mode: 'full', cancelItems: false }), reasonCode: 'other' as const };
    const blocked = refundFormView(o, base, { cashless: true });
    expect(blocked.cashBlocked).toBe(true);
    expect(blocked.ready).toBe(false);
    // Ohne Modus wie bisher.
    expect(refundFormView(o, base).cashBlocked).toBe(false);
    expect(refundFormView(o, base).ready).toBe(true);
  });

  test('a cash-only order cannot be refunded in cashless mode', () => {
    const o = order([payment('cash-1', 'cash', 10, '2026-10-08T10:00:00Z')]);
    const state = {
      ...initialRefundState(o, { mode: 'amount', cancelItems: false }, { cashless: true }),
      amount: '1',
      reasonCode: 'other' as const,
    };
    const view = refundFormView(o, state, { cashless: true });
    expect(view.payments).toEqual([]);
    expect(view.cashBlocked).toBe(true);
    expect(view.ready).toBe(false);
  });
});
