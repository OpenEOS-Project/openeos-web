import { expect, test } from '@playwright/test';

import { checkoutCancellationHint, describeEventUnlock, formatUnlockDeadline } from '@/utils/event-unlock';
import type { EventBilling } from '@/types/billing';

import { inTimeZone, TIME_ZONES } from './helpers';

function billing(overrides: Partial<EventBilling> = {}): EventBilling {
  return {
    pricePerDay: 25,
    days: 2,
    price: 50,
    discountPercent: 0,
    discountReason: null,
    finalPrice: 50,
    onlinePaymentAvailable: true,
    billingMode: 'prepaid',
    billingStatus: 'paid',
    organizationName: 'Musikverein',
    billingEmail: 'kasse@example.org',
    billingAddress: null,
    paidAt: '2026-08-01T10:00:00.000Z',
    priceCharged: 50,
    cancellation: {
      allowed: true,
      deadline: '2026-09-04T15:00:00.000Z',
      timezone: 'Europe/Berlin',
      blockedReason: null,
    },
    lastCancellation: null,
    ...overrides,
  };
}

test.describe('formatUnlockDeadline', () => {
  test('shows weekday, date and time in the organization time zone', () => {
    // 15:00 UTC sind im Berliner Sommer 17:00 — egal, wo der Browser steht.
    for (const zone of TIME_ZONES) {
      inTimeZone(zone, () => {
        expect(formatUnlockDeadline('2026-09-04T15:00:00.000Z', 'de', 'Europe/Berlin')).toBe(
          'Fr., 04.09.2026, 17:00',
        );
      });
    }
  });

  test('uses the British format in English', () => {
    expect(formatUnlockDeadline('2026-09-04T15:00:00.000Z', 'en', 'Europe/Berlin')).toBe('Fri, 04/09/2026, 17:00');
  });

  test('follows winter time', () => {
    expect(formatUnlockDeadline('2026-11-27T16:00:00.000Z', 'de', 'Europe/Berlin')).toBe('Fr., 27.11.2026, 17:00');
  });

  test('shows a deadline at midnight as the previous day, 23:59', () => {
    // Beginn Sa 12.09.2026 00:00 Berlin -> Frist Sa 05.09. 00:00 = Fr 04.09. 22:00 UTC
    for (const zone of TIME_ZONES) {
      inTimeZone(zone, () => {
        expect(formatUnlockDeadline('2026-09-04T22:00:00.000Z', 'de', 'Europe/Berlin')).toBe(
          'Fr., 04.09.2026, 23:59',
        );
        expect(formatUnlockDeadline('2026-09-04T22:00:00.000Z', 'en', 'Europe/Berlin')).toBe(
          'Fri, 04/09/2026, 23:59',
        );
      });
    }
  });

  test('midnight is judged in the organization time zone, not in UTC', () => {
    // 00:00 UTC ist in Berlin 02:00 — keine Mitternacht, also unverändert.
    expect(formatUnlockDeadline('2026-09-05T00:00:00.000Z', 'de', 'Europe/Berlin')).toBe('Sa., 05.09.2026, 02:00');
    // In New York ist 04:00 UTC Mitternacht.
    expect(formatUnlockDeadline('2026-09-05T04:00:00.000Z', 'de', 'America/New_York')).toBe('Fr., 04.09.2026, 23:59');
  });

  test('leaves times shortly after midnight alone', () => {
    expect(formatUnlockDeadline('2026-09-04T22:01:00.000Z', 'de', 'Europe/Berlin')).toBe('Sa., 05.09.2026, 00:01');
  });
});

test.describe('describeEventUnlock', () => {
  test('paid and inside the deadline is cancellable', () => {
    expect(describeEventUnlock(billing())).toEqual({
      kind: 'cancellable',
      via: 'stripe',
      deadline: '2026-09-04T15:00:00.000Z',
    });
  });

  test('invoice orders are cancellable too', () => {
    expect(describeEventUnlock(billing({ billingStatus: 'invoice' }))).toMatchObject({
      kind: 'cancellable',
      via: 'invoice',
    });
  });

  test('after the deadline it is locked with the reason', () => {
    const view = describeEventUnlock(
      billing({
        cancellation: {
          allowed: false,
          deadline: '2026-09-04T15:00:00.000Z',
          timezone: 'Europe/Berlin',
          blockedReason: 'deadline_passed',
        },
      }),
    );
    expect(view).toEqual({
      kind: 'locked',
      via: 'stripe',
      reason: 'deadline_passed',
      deadline: '2026-09-04T15:00:00.000Z',
    });
  });

  test('real orders lock it', () => {
    const view = describeEventUnlock(
      billing({
        cancellation: {
          allowed: false,
          deadline: '2026-09-04T15:00:00.000Z',
          timezone: 'Europe/Berlin',
          blockedReason: 'has_orders',
        },
      }),
    );
    expect(view).toMatchObject({ kind: 'locked', reason: 'has_orders' });
  });

  test('waived and unpaid events have nothing to cancel', () => {
    expect(describeEventUnlock(billing({ billingStatus: 'waived' }))).toEqual({ kind: 'waived' });
    expect(describeEventUnlock(billing({ billingStatus: 'none' }))).toEqual({ kind: 'not_unlocked' });
    expect(describeEventUnlock(billing({ billingStatus: 'pending' }))).toEqual({ kind: 'not_unlocked' });
  });
});

test.describe('checkoutCancellationHint', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  test('names the deadline while it is ahead', () => {
    expect(checkoutCancellationHint(billing(), now)).toEqual({
      kind: 'until',
      deadline: '2026-09-04T15:00:00.000Z',
    });
  });

  test('warns when paying would already be too late to cancel', () => {
    expect(checkoutCancellationHint(billing(), new Date('2026-09-04T15:00:00.000Z'))).toEqual({ kind: 'too_late' });
  });

  test('stays quiet without a deadline', () => {
    const noDeadline = billing({
      cancellation: { allowed: false, deadline: null, timezone: 'Europe/Berlin', blockedReason: 'not_paid' },
    });
    expect(checkoutCancellationHint(noDeadline, now)).toBeNull();
  });
});
