import { cashDrawerAvailable, cashDrawerConfigured, shouldOpenCashDrawer } from '@/utils/cash-drawer';
import { expect, test } from '@playwright/test';

/*
 * Kassenlade: nur öffnen, wenn dem Gerät ein Drucker mit Lade zugeordnet
 * ist (sonst antwortet die API mit CASH_DRAWER_NOT_CONFIGURED) und Bargeld
 * überhaupt möglich ist.
 */

const configured = { cashDrawerPrinterId: 'printer-1' };

const base = {
  open: true,
  method: 'cash' as string | null,
  amount: 12.5,
  cashless: false,
  settings: configured as { cashDrawerPrinterId?: unknown } | null,
  alreadyOpened: false,
};

test.describe('cash drawer', () => {
  test('configured only with a non-empty printer id', () => {
    expect(cashDrawerConfigured(undefined)).toBe(false);
    expect(cashDrawerConfigured(null)).toBe(false);
    expect(cashDrawerConfigured({})).toBe(false);
    expect(cashDrawerConfigured({ cashDrawerPrinterId: '' })).toBe(false);
    expect(cashDrawerConfigured({ cashDrawerPrinterId: '   ' })).toBe(false);
    expect(cashDrawerConfigured({ cashDrawerPrinterId: null })).toBe(false);
    expect(cashDrawerConfigured({ cashDrawerPrinterId: 42 })).toBe(false);
    expect(cashDrawerConfigured(configured)).toBe(true);
  });

  test('not available in cashless mode even when configured', () => {
    expect(cashDrawerAvailable({ settings: configured, cashless: false })).toBe(true);
    expect(cashDrawerAvailable({ settings: configured, cashless: true })).toBe(false);
    expect(cashDrawerAvailable({ settings: null, cashless: false })).toBe(false);
  });

  test('opens on the first switch to cash with a configured drawer', () => {
    expect(shouldOpenCashDrawer(base)).toBe(true);
  });

  test('a freshly paired device without a drawer printer never calls the API', () => {
    expect(shouldOpenCashDrawer({ ...base, settings: null })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, settings: {} })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, settings: { cashDrawerPrinterId: '' } })).toBe(false);
  });

  test('no drawer for cashless, card, zero amounts, closed sheet or a second time', () => {
    expect(shouldOpenCashDrawer({ ...base, cashless: true })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, method: 'card' })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, method: null })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, amount: 0 })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, open: false })).toBe(false);
    expect(shouldOpenCashDrawer({ ...base, alreadyOpened: true })).toBe(false);
  });
});
