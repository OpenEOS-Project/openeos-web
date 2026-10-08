import {
  STATUS_FILTERS,
  cancellableQuantity,
  groupByDay,
  isStarted,
  itemsSummary,
  orderPlace,
  paymentBadges,
  startOfLocalDay,
} from '@/utils/order-history';
import { expect, test } from '@playwright/test';

import { ORDER_DISPLAY_STATUSES } from '@/types/order-history';

import { TIME_ZONES, inTimeZone } from './helpers';

test.describe('order history (POS + admin)', () => {
  test('short content: grouped by product, cancelled left out, rest as number', () => {
    expect(
      itemsSummary([
        { productName: 'Burger', quantity: 2, status: 'pending' },
        { productName: 'Pils', quantity: 2, status: 'ready' },
        { productName: 'Burger', quantity: 1, status: 'delivered' },
        { productName: 'Cola', quantity: 1, status: 'cancelled' },
        { productName: 'Wasser', quantity: 1, status: 'pending' },
        { productName: 'Pommes', quantity: 4, status: 'pending' },
      ])
    ).toEqual({ parts: ['3x Burger', '2x Pils', '1x Wasser'], more: 1 });
  });

  test('payment icons: one per method, voucher on top', () => {
    expect(
      paymentBadges({ paymentMethods: ['cash', 'sumup_terminal', 'cash'], discountAmount: 2 }).map(
        (b) => [b.key, b.icon]
      )
    ).toEqual([
      ['cash', 'cash'],
      ['sumup', 'contactless'],
      ['discount', 'percent'],
    ]);
    expect(
      paymentBadges({ paymentMethods: ['card'], discountAmount: 0 }).map((b) => b.icon)
    ).toEqual(['card']);
  });

  test('place: table, counter or to-go', () => {
    expect(
      orderPlace({ tableNumber: 'A06', source: 'pos', fulfillmentType: 'table_service' })
    ).toBe('table');
    expect(
      orderPlace({ tableNumber: null, source: 'pos', fulfillmentType: 'counter_pickup' })
    ).toBe('counter');
    expect(
      orderPlace({ tableNumber: null, source: 'online', fulfillmentType: 'counter_pickup' })
    ).toBe('togo');
  });

  test('status filters cover every display status exactly once', () => {
    const covered = STATUS_FILTERS.flatMap((f) => f.statuses).sort();
    expect(covered).toEqual([...ORDER_DISPLAY_STATUSES].sort());
  });

  test('cancellable quantity and kitchen start', () => {
    expect(cancellableQuantity({ status: 'pending', quantity: 3, refundedQuantity: 1 })).toBe(2);
    expect(cancellableQuantity({ status: 'cancelled', quantity: 3 })).toBe(0);
    expect(isStarted('pending')).toBe(false);
    expect(['preparing', 'ready', 'delivered'].every(isStarted)).toBe(true);
  });

  for (const zone of TIME_ZONES) {
    test(`groups by local day (today, yesterday, date) in ${zone}`, () => {
      inTimeZone(zone, () => {
        const now = new Date(2026, 9, 8, 0, 30); // 08.10., 00:30 lokal
        const at = (d: number, h: number) => new Date(2026, 9, d, h, 15).toISOString();
        const groups = groupByDay(
          [
            { createdAt: at(8, 0) },
            { createdAt: at(7, 23) },
            { createdAt: at(7, 12) },
            { createdAt: at(5, 20) },
          ],
          now
        );
        expect(groups.map((g) => [g.kind, g.rows.length])).toEqual([
          ['today', 1],
          ['yesterday', 2],
          ['date', 1],
        ]);
        expect(new Date(startOfLocalDay(now)).getHours()).toBe(0);
        expect(new Date(startOfLocalDay(now)).getDate()).toBe(8);
      });
    });
  }
});
