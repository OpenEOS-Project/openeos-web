import { expect, test } from '@playwright/test';

import { planPlatformRefund } from '@/utils/platform-refund';
import type { PlatformCancellationPreview } from '@/types/billing';

function preview(overrides: Partial<PlatformCancellationPreview> = {}): PlatformCancellationPreview {
  return {
    eventId: 'e1',
    billingStatus: 'paid',
    via: 'stripe',
    currency: 'EUR',
    amountCharged: 40,
    refundedSoFar: 0,
    refundable: 40,
    realOrders: 0,
    deadline: '2026-09-04T15:00:00.000Z',
    timezone: 'Europe/Berlin',
    deadlinePassed: true,
    invoiced: false,
    onlineRefundAvailable: true,
    ...overrides,
  };
}

test.describe('planPlatformRefund', () => {
  test('full amount without real orders is a cancellation (unlock removed)', () => {
    const plan = planPlatformRefund(preview(), { mode: 'full', amountText: '', reason: 'abgesagt' });
    expect(plan).toEqual({ amount: 40, payloadAmount: null, keepsUnlock: false, problem: null });
  });

  test('real orders make it goodwill, even for the full amount', () => {
    const plan = planPlatformRefund(preview({ realOrders: 3 }), { mode: 'full', amountText: '', reason: 'Kulanz' });
    expect(plan.keepsUnlock).toBe(true);
    expect(plan.payloadAmount).toBeNull();
    expect(plan.problem).toBeNull();
  });

  test('a partial amount is goodwill and is sent as a number (comma accepted)', () => {
    const plan = planPlatformRefund(preview(), { mode: 'partial', amountText: '12,50', reason: 'Teil' });
    expect(plan).toEqual({ amount: 12.5, payloadAmount: 12.5, keepsUnlock: true, problem: null });
  });

  test('a "partial" amount equal to everything refundable counts as full', () => {
    const plan = planPlatformRefund(preview(), { mode: 'partial', amountText: '40', reason: 'x' });
    expect(plan.payloadAmount).toBeNull();
    expect(plan.keepsUnlock).toBe(false);
  });

  test('requires a reason', () => {
    expect(planPlatformRefund(preview(), { mode: 'full', amountText: '', reason: '   ' }).problem).toBe(
      'reason_required',
    );
  });

  test('rejects zero, garbage and more than refundable', () => {
    const p = preview({ refundedSoFar: 30, refundable: 10 });
    expect(planPlatformRefund(p, { mode: 'partial', amountText: '0', reason: 'x' }).problem).toBe('amount_invalid');
    expect(planPlatformRefund(p, { mode: 'partial', amountText: 'abc', reason: 'x' }).problem).toBe('amount_invalid');
    expect(planPlatformRefund(p, { mode: 'partial', amountText: '10,01', reason: 'x' }).problem).toBe(
      'amount_too_high',
    );
    expect(planPlatformRefund(p, { mode: 'partial', amountText: '10', reason: 'x' }).problem).toBeNull();
  });

  test('nothing left or no online refund blocks the dialog', () => {
    expect(planPlatformRefund(preview({ refundable: 0 }), { mode: 'full', amountText: '', reason: 'x' }).problem).toBe(
      'nothing_refundable',
    );
    expect(
      planPlatformRefund(preview({ onlineRefundAvailable: false }), { mode: 'full', amountText: '', reason: 'x' })
        .problem,
    ).toBe('online_refund_unavailable');
  });
});
