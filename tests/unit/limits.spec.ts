import { expect, test } from '@playwright/test';

import { seatUsage } from '@/utils/limits';

test.describe('seatUsage: seats against a limit', () => {
  test('counts remaining seats below the limit', () => {
    expect(seatUsage(7, 10)).toEqual({ used: 7, limit: 10, unlimited: false, full: false, remaining: 3 });
  });

  test('is full exactly at the limit and beyond it', () => {
    expect(seatUsage(10, 10).full).toBe(true);
    expect(seatUsage(10, 10).remaining).toBe(0);
    // Ein Super-Admin kann ueber die Schranke hinaus einladen; danach
    // darf es nicht negativ werden.
    expect(seatUsage(12, 10)).toMatchObject({ full: true, remaining: 0 });
  });

  test('0 means unlimited and is never full', () => {
    expect(seatUsage(500, 0)).toEqual({ used: 500, limit: 0, unlimited: true, full: false, remaining: null });
  });

  test('missing numbers never block the user', () => {
    expect(seatUsage(undefined, undefined)).toMatchObject({ used: 0, unlimited: true, full: false });
    expect(seatUsage(3, null)).toMatchObject({ used: 3, unlimited: true, full: false });
    expect(seatUsage(null, 5)).toMatchObject({ used: 0, limit: 5, full: false, remaining: 5 });
  });

  test('ignores negative or fractional input', () => {
    expect(seatUsage(-2, 5)).toMatchObject({ used: 0, remaining: 5 });
    expect(seatUsage(4.9, 5.7)).toMatchObject({ used: 4, limit: 5, full: false, remaining: 1 });
    expect(seatUsage(3, -1).unlimited).toBe(true);
  });
});
