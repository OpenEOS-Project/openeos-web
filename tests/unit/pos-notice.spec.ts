import { expect, test } from '@playwright/test';

import { posNotice, type PosNoticeInput } from '@/app/[locale]/device/pos/utils/pos-notice';

const none: PosNoticeInput = { phase: 'active', offline: false, tseOutage: false, cashBlocked: false, orderOnly: false };
const all: PosNoticeInput = { ...none, offline: true, tseOutage: true, cashBlocked: true, orderOnly: true };

test.describe('POS notice under the header', () => {
  test('nothing to say during normal sales', () => {
    expect(posNotice(none)).toBeNull();
    expect(posNotice({ ...none, phase: null })).toBeNull();
  });

  test('ended beats test operation and every other notice', () => {
    expect(posNotice({ ...all, phase: 'ended' })).toBe('ended');
  });

  test('test operation and test mode beat the other notices (TSE training included)', () => {
    expect(posNotice({ ...all, phase: 'planned' })).toBe('planned');
    expect(posNotice({ ...all, phase: 'test' })).toBe('test');
  });

  test('otherwise offline, TSE outage, cash blocked, orders only — one at a time', () => {
    expect(posNotice(all)).toBe('offline');
    expect(posNotice({ ...all, offline: false })).toBe('tseOutage');
    expect(posNotice({ ...all, offline: false, tseOutage: false })).toBe('cashBlocked');
    expect(posNotice({ ...none, orderOnly: true })).toBe('orderOnly');
  });
});
