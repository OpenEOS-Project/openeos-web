import { expect, test } from '@playwright/test';

import { countOrderItems, recentOrdersQuery, RECENT_ORDERS_LIMIT } from '@/lib/recent-orders';
import type { OrderItem } from '@/types/order';

const item = (quantity: number) => ({ quantity }) as OrderItem;

test.describe('dashboard: recent orders', () => {
  test('asks the API for the order items', () => {
    expect(recentOrdersQuery('2026-09-12')).toEqual({
      dateFrom: '2026-09-12',
      dateTo: '2026-09-12',
      includeItems: true,
      page: 1,
      limit: RECENT_ORDERS_LIMIT,
    });
  });

  test('counts quantities, not lines', () => {
    expect(countOrderItems({ items: [item(2), item(1)] })).toBe(3);
    expect(countOrderItems({ items: [] })).toBe(0);
  });

  test('unknown when the items were not loaded', () => {
    expect(countOrderItems({} as { items: OrderItem[] })).toBeNull();
  });
});
