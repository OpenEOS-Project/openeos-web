import { expect, test } from '@playwright/test';

import {
  canCompleteOrder,
  effectiveOrderingMode,
  getOperatingMode,
  isOrderOnlyMode,
  itemsInProduction,
  operatingModeSwitchError,
  orderOnlyDocsUrl,
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
