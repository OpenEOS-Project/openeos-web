import { expect, test } from '@playwright/test';

import type { CustomerCartPayload } from '@/hooks/use-customer-display-broadcast';

import {
  canCompleteOrder,
  customerDisplayShowsPrices,
  dashboardAmount,
  effectiveOrderingMode,
  getOperatingMode,
  isOrderOnlyMode,
  itemsInProduction,
  operatingModeSwitchError,
  orderOnlyDocsUrl,
  rankByMode,
  stripCartPrices,
  tableCloseState,
} from '@/lib/operating-mode';

/*
 * Betriebsart „Nur Bestellen“: Erkennung wie in der API, Kassiermodus,
 * Abschluss ohne Zahlung (nicht, solange eine Station arbeitet) und die
 * Prüfung beim Umschalten durch den Support.
 */

type Status = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
const item = (status: Status, productionStationId: string | null = null, quantity = 1) => ({
  status,
  productionStationId,
  quantity,
});

test.describe('operating mode', () => {
  test('only an explicit order_only counts', () => {
    expect(getOperatingMode(undefined)).toBe('pos');
    expect(getOperatingMode({})).toBe('pos');
    expect(getOperatingMode({ operatingMode: 'ORDER_ONLY' })).toBe('pos');
    expect(getOperatingMode({ operatingMode: 'order_only' })).toBe('order_only');
    expect(isOrderOnlyMode({ operatingMode: 'order_only' })).toBe(true);
    expect(isOrderOnlyMode({ operatingMode: 'pos' })).toBe(false);
  });

  test('order-only always sends (tab), never checks out immediately', () => {
    expect(effectiveOrderingMode('immediate', true)).toBe('tab');
    expect(effectiveOrderingMode(undefined, true)).toBe('tab');
    expect(effectiveOrderingMode(undefined, false)).toBe('immediate');
    expect(effectiveOrderingMode('tab', false)).toBe('tab');
    expect(effectiveOrderingMode('immediate', false)).toBe('immediate');
  });

  test('docs link per language', () => {
    expect(orderOnlyDocsUrl('de')).toBe('https://docs.openeos.de/nur-bestellen');
    expect(orderOnlyDocsUrl('en')).toBe('https://docs.openeos.de/en/nur-bestellen');
  });
});

test.describe('closing without payment', () => {
  test('items still at a station block closing; items without a station do not', () => {
    const items = [item('pending'), item('preparing', 's1', 2), item('ready', 's1'), item('cancelled', 's1')];
    expect(itemsInProduction(items)).toHaveLength(1);
    expect(canCompleteOrder({ status: 'in_progress', items })).toBe(false);
    expect(canCompleteOrder({ status: 'open', items: [item('pending'), item('ready', 's1')] })).toBe(true);
    expect(canCompleteOrder({ status: 'completed', items: [] })).toBe(false);
    expect(canCompleteOrder({ status: 'cancelled', items: [] })).toBe(false);
  });

  test('closing a table takes all open orders, or none while something is cooking', () => {
    const ready = { id: 'o1', status: 'ready', items: [item('ready', 's1')] };
    const drinks = { id: 'o2', status: 'open', items: [item('pending')] };
    const cooking = { id: 'o3', status: 'in_progress', items: [item('preparing', 's1', 3)] };
    const done = { id: 'o4', status: 'completed', items: [] };

    expect(tableCloseState([ready, drinks, done])).toEqual({ orderIds: ['o1', 'o2'], canClose: true, blocked: 0 });
    expect(tableCloseState([ready, cooking])).toEqual({ orderIds: ['o1', 'o3'], canClose: false, blocked: 3 });
    expect(tableCloseState([])).toEqual({ orderIds: [], canClose: false, blocked: 0 });
  });
});

test.describe('switch by support', () => {
  test('needs a different mode and a reason of at least 5 characters', () => {
    expect(operatingModeSwitchError('pos', 'pos', 'Antrag vom 01.11.')).toBe('unchanged');
    expect(operatingModeSwitchError('pos', 'order_only', '  abc  ')).toBe('reasonTooShort');
    expect(operatingModeSwitchError('pos', 'order_only', 'x'.repeat(501))).toBe('reasonTooLong');
    expect(operatingModeSwitchError('pos', 'order_only', 'Antrag per E-Mail')).toBeNull();
    expect(operatingModeSwitchError('order_only', 'pos', 'Verein kassiert wieder')).toBeNull();
  });
});

test.describe('customer display without money', () => {
  const cart: CustomerCartPayload = {
    status: 'active',
    items: [
      { id: 'a', name: 'Bratwurst', quantity: 2, unitPrice: 3.5, lineTotal: 7, options: [], pfandAmount: 0, isRefill: false },
      { id: 'b', name: 'Bier', quantity: 1, unitPrice: 4, lineTotal: 4, options: [], pfandAmount: 2, isRefill: false },
    ],
    totals: { subtotal: 11, discount: 1, pfand: 2, payable: 12 },
    vouchers: [{ name: 'Helfer', amount: 1 }],
    updatedAt: 1,
  };

  test('the POS sends items and quantities but no amounts', () => {
    const stripped = stripCartPrices(cart);
    expect(stripped.orderOnly).toBe(true);
    expect(stripped.items.map((i) => [i.name, i.quantity])).toEqual([
      ['Bratwurst', 2],
      ['Bier', 1],
    ]);
    expect(stripped.items.every((i) => i.unitPrice === 0 && i.lineTotal === 0 && i.pfandAmount === 0)).toBe(true);
    expect(stripped.totals).toEqual({ subtotal: 0, discount: 0, pfand: 0, payable: 0 });
    expect(stripped.vouchers).toEqual([{ name: 'Helfer', amount: 0 }]);
    // Original bleibt unverändert
    expect(cart.totals.payable).toBe(12);
  });

  test('prices only in till mode and only for carts with prices', () => {
    expect(customerDisplayShowsPrices({}, cart)).toBe(true);
    expect(customerDisplayShowsPrices(undefined, null)).toBe(true);
    expect(customerDisplayShowsPrices({ operatingMode: 'order_only' }, cart)).toBe(false);
    expect(customerDisplayShowsPrices({}, { orderOnly: true })).toBe(false);
  });
});

test.describe('reports and dashboard without revenue', () => {
  const rows = [
    { name: 'Steak', qty: 2, amount: 30 },
    { name: 'Bier', qty: 10, amount: 40 },
    { name: 'Wasser', qty: 10, amount: 20 },
  ];

  test('order-only ranks by quantity, till mode by revenue', () => {
    const qty = (r: (typeof rows)[number]) => r.qty;
    const amount = (r: (typeof rows)[number]) => r.amount;
    expect(rankByMode(rows, true, qty, amount).map((r) => r.name)).toEqual(['Bier', 'Wasser', 'Steak']);
    expect(rankByMode(rows, false, qty, amount).map((r) => r.name)).toEqual(['Bier', 'Steak', 'Wasser']);
    expect(rows[0].name).toBe('Steak');
  });

  test('tile amount: revenue = paid, order value = all orders without cancellations', () => {
    const orders = [
      { status: 'completed', paymentStatus: 'paid', paidAmount: 10, total: 10 },
      { status: 'completed', paymentStatus: 'unpaid', paidAmount: 0, total: 7.5 },
      { status: 'cancelled', paymentStatus: 'unpaid', paidAmount: 0, total: 99 },
    ];
    expect(dashboardAmount(orders, false)).toBe(10);
    expect(dashboardAmount(orders, true)).toBe(17.5);
  });
});
