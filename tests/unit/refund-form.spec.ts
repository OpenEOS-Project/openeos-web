import { resolvePosCardMode } from '@/utils/pos-card-mode';
import {
  cancelItemsPayload,
  cancelItemsView,
  initialCancelItemsState,
  initialRefundState,
  parseAmount,
  refundFormView,
  refundMethod,
  refundPayload,
  toggleAllCancelItems,
} from '@/utils/refund-form';
import { netReconciliation } from '@/utils/report-net';
import { expect, test } from '@playwright/test';

import type { OrderDetail, OrderDetailItem, OrderDetailPayment } from '@/types/order-history';

/*
 * Gemeinsame Formularlogik für Storno und Erstattung (Kasse + Verwaltung),
 * Kartenmodus der Kasse im Testmodus und Abgleich der Produktberichte.
 */

function item(id: string, extra: Partial<OrderDetailItem> = {}): OrderDetailItem {
  return {
    id,
    productId: `p-${id}`,
    productName: id,
    categoryName: 'Essen',
    quantity: 2,
    unitPrice: 10,
    optionsPrice: 0,
    totalPrice: 20,
    taxRate: 19,
    depositAmount: 0,
    isRefill: false,
    options: [],
    notes: null,
    kitchenNotes: null,
    status: 'pending',
    productionStationId: null,
    paidQuantity: 2,
    refundedQuantity: 0,
    refundableQuantity: 2,
    unitRefund: 9,
    preparedAt: null,
    readyAt: null,
    deliveredAt: null,
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:00:00Z',
    ...extra,
  };
}

function payment(id: string, extra: Partial<OrderDetailPayment> = {}): OrderDetailPayment {
  return {
    id,
    amount: 20,
    paymentMethod: 'cash',
    paymentProvider: 'CASH',
    status: 'captured',
    providerTransactionId: null,
    amountReceived: null,
    change: null,
    tipAmount: null,
    batchOrderCount: null,
    cardBrand: null,
    cardLastFour: null,
    refundedAmount: 0,
    refundable: 20,
    createdAt: '2026-10-08T10:00:00Z',
    deviceId: null,
    deviceName: null,
    userName: null,
    ...extra,
  };
}

function order(extra: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'o1',
    orderNumber: '20261008-0001',
    dailyNumber: 1,
    createdAt: '2026-10-08T10:00:00Z',
    tableNumber: null,
    fulfillmentType: 'counter_pickup',
    source: 'pos',
    customerName: null,
    notes: null,
    status: 'in_progress',
    paymentStatus: 'paid',
    displayStatus: 'in_kitchen',
    subtotal: 44,
    taxTotal: 0,
    total: 40,
    paidAmount: 40,
    refundedAmount: 0,
    refundable: 40,
    remaining: 0,
    tipAmount: 0,
    discountAmount: 4,
    discountReason: null,
    pfandTotal: 0,
    isTest: false,
    eventId: 'e1',
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdByDeviceId: null,
    deviceName: null,
    createdByUserName: null,
    items: [
      item('Burger'),
      item('Pils', { status: 'ready', unitPrice: 4, totalPrice: 8, unitRefund: 3.6, depositAmount: 2 }),
    ],
    payments: [payment('pay-1', { amount: 40, refundable: 40 })],
    refunds: [],
    events: [],
    ...extra,
  } as OrderDetail;
}

test.describe('refund form (POS + admin)', () => {
  test('amount input accepts a comma', () => {
    expect(parseAmount('4,50')).toBe(4.5);
    expect(Number.isNaN(parseAmount(''))).toBe(true);
  });

  test('items: preview with deposit, reason required, payload', () => {
    const o = order();
    const state = { ...initialRefundState(o, { mode: 'items', cancelItems: false }), qty: { Pils: 1 } };
    // Einzige erstattbare Zahlung ist vorgewählt.
    expect(state.paymentId).toBe('pay-1');
    let view = refundFormView(o, state);
    expect(view.preview).toBe(5.6);
    expect(view.hasDeposit).toBe(true);
    expect(view.ready).toBe(false);

    const ready = { ...state, reasonCode: 'quality' as const, includeDeposit: false };
    view = refundFormView(o, ready);
    expect(view.preview).toBe(3.6);
    expect(view.ready).toBe(true);
    expect(refundPayload(ready, view, false)).toEqual({
      mode: 'items',
      reasonCode: 'quality',
      items: [{ orderItemId: 'Pils', quantity: 1 }],
      includeDeposit: false,
      paymentId: 'pay-1',
    });
  });

  test('cancel & refund: started positions need confirmation', () => {
    const o = order();
    const state = {
      ...initialRefundState(o, { mode: 'items', cancelItems: true }),
      qty: { Pils: 1 },
      reasonCode: 'wrong_order' as const,
    };
    let view = refundFormView(o, state);
    expect(view.started.map((i) => i.id)).toEqual(['Pils']);
    expect(view.ready).toBe(false);
    view = refundFormView(o, { ...state, confirmStarted: true });
    expect(view.ready).toBe(true);
    expect(refundPayload({ ...state, confirmStarted: true }, view, true)).toMatchObject({
      cancelItems: true,
      confirmStarted: true,
      manual: true,
    });
  });

  test('amount: limited to the refundable amount', () => {
    const o = order();
    const base = { ...initialRefundState(o, { mode: 'amount', cancelItems: false }), reasonCode: 'other' as const };
    expect(refundFormView(o, { ...base, amount: '50' }).amountInvalid).toBe(true);
    const view = refundFormView(o, { ...base, amount: '12,5' });
    expect(view.ready).toBe(true);
    expect(refundPayload({ ...base, amount: '12,5' }, view, false)).toMatchObject({ mode: 'amount', amount: 12.5 });
  });

  test('refund method follows the original payment; test orders are only booked', () => {
    expect(refundMethod(order(), payment('a'))).toBe('cash');
    expect(refundMethod(order(), payment('b', { paymentMethod: 'sumup_terminal' }))).toBe('sumup');
    expect(refundMethod(order(), payment('c', { paymentMethod: 'card' }))).toBe('card');
    expect(refundMethod(order({ isTest: true }), payment('d', { paymentMethod: 'sumup_terminal' }))).toBe('test');
    expect(refundMethod(order({ isTest: true }), payment('e'))).toBe('cash');
  });

  test('cancel items: single item preselected, select all, payload', () => {
    const single = order({ items: [item('Burger', { refundedQuantity: 1 })] });
    expect(initialCancelItemsState(single).qty).toEqual({ Burger: 1 });

    const o = order();
    const state = initialCancelItemsState(o);
    const view = cancelItemsView(o, state);
    const all = { ...state, qty: toggleAllCancelItems(view) };
    const allView = cancelItemsView(o, all);
    expect(allView.all).toBe(true);
    expect(allView.count).toBe(4);
    expect(allView.value).toBe(28);
    // Pils ist fertig: Grund und Bestätigung nötig.
    expect(allView.needsReason).toBe(true);
    expect(allView.ready).toBe(false);
    const confirmed = { ...all, confirmStarted: true, reasonCode: 'duplicate' as const };
    expect(cancelItemsPayload(confirmed, cancelItemsView(o, confirmed))).toEqual({
      items: [
        { orderItemId: 'Burger', quantity: 2 },
        { orderItemId: 'Pils', quantity: 2 },
      ],
      reasonCode: 'duplicate',
      confirmStarted: true,
    });
  });
});

test.describe('POS card mode', () => {
  test('SumUp is disabled (not hidden) in test mode', () => {
    expect(resolvePosCardMode({ readerLinked: true, sumupEnabled: true, isTest: false })).toBe('sumup');
    expect(resolvePosCardMode({ readerLinked: true, sumupEnabled: true, isTest: true })).toBe('sumup_test');
    expect(resolvePosCardMode({ readerLinked: false, sumupEnabled: true, isTest: true })).toBeNull();
    expect(resolvePosCardMode({ readerLinked: true, sumupEnabled: false, isTest: false })).toBeNull();
  });
});

test.describe('net product report', () => {
  test('rows + refunds without an item + tips = net revenue', () => {
    expect(
      netReconciliation([148, 43.2], { itemsRevenue: 191.2, unassignedRefunds: -5, tips: 2, netRevenue: 188.2 })
    ).toEqual([
      { key: 'items', amount: 191.2 },
      { key: 'unassignedRefunds', amount: -5 },
      { key: 'tips', amount: 2 },
      { key: 'netRevenue', amount: 188.2 },
    ]);
  });

  test('cent differences from the discount spread show as rounding', () => {
    expect(
      netReconciliation([3.33, 3.33, 3.33], { itemsRevenue: 10, unassignedRefunds: 0, tips: 0, netRevenue: 10 })
    ).toEqual([
      { key: 'items', amount: 9.99 },
      { key: 'rounding', amount: 0.01 },
      { key: 'netRevenue', amount: 10 },
    ]);
  });
});
