import { expect, test } from '@playwright/test';

import type { CustomerCartPayload } from '@/hooks/use-customer-display-broadcast';

import {
  canCompleteOrder,
  canSwitchTo,
  certificateAvailable,
  countryNoticeKind,
  customerDisplayShowsPrices,
  dashboardNoticeKind,
  effectiveOrderingMode,
  getOperatingMode,
  itemsInProduction,
  legacyNoticeKind,
  operatingModeDocsUrl,
  operatingModeLabelValue,
  operatingModeOption,
  operatingModeOptions,
  operatingModeSwitchError,
  rankByMode,
  resolveOperatingMode,
  stripCartPrices,
  switchIsOneWay,
  tableCloseState,
  type OperatingMode,
  type OperatingModeOrg,
} from '@/lib/operating-mode';

/*
 * Betriebsarten „Nur Bons“ (orders_only), „Bargeldlos“ (cashless) und
 * „Alle Funktionen“ (full): Regeln wie in der API, Matrix über Land,
 * Betriebsart, Bestand und TSE; dazu Kasse („Abgeholt“, „Tisch
 * abschließen“), Kundenanzeige ohne Preise und die Auswertung.
 */

type Status = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
const item = (status: Status, productionStationId: string | null = null, quantity = 1) => ({
  status,
  productionStationId,
  quantity,
});

const COUNTRIES = ['DE', 'AT', 'CH', 'FR'] as const;
const MODES: OperatingMode[] = ['orders_only', 'cashless', 'full'];

/** Erwartung wie in der API (contract): Bargeld nur in `full`, in DE nur mit Bestand oder TSE. */
function expectedCash(country: string, mode: OperatingMode, legacy: boolean, tse: boolean): boolean {
  return mode === 'full' && (country !== 'DE' || legacy || tse);
}

test.describe('operating mode matrix (country × mode × legacy × TSE)', () => {
  for (const country of COUNTRIES) {
    for (const mode of MODES) {
      for (const legacy of [false, true]) {
        for (const tseActive of [false, true]) {
          // Bestand gibt es nur als `full`.
          if (legacy && mode !== 'full') continue;
          test(`${country} ${mode}${legacy ? ' legacy' : ''}${tseActive ? ' TSE' : ''}`, () => {
            const org: OperatingModeOrg = { country, operatingMode: mode, operatingModeLegacy: legacy, tseActive };
            const view = resolveOperatingMode(org);
            const cash = expectedCash(country, mode, legacy, tseActive);

            expect(view.mode).toBe(mode);
            expect(view.cashAllowed).toBe(cash);
            expect(view.pricesVisible).toBe(mode !== 'orders_only');
            expect(view.paymentsEnabled).toBe(mode !== 'orders_only');
            expect(view.ordersOnly).toBe(mode === 'orders_only');
            expect(view.cashBlockedWithoutTse).toBe(mode === 'full' && !cash);

            // Wählbar: `orders_only` und `cashless` immer, `full` außerhalb DE oder mit TSE.
            const fullSelectable = country !== 'DE' || tseActive;
            expect(operatingModeOption(org, 'orders_only').available).toBe(true);
            expect(operatingModeOption(org, 'cashless').available).toBe(true);
            expect(operatingModeOption(org, 'full')).toEqual({
              mode: 'full',
              available: fullSelectable,
              unavailableReason: fullSelectable ? null : 'tse_required',
            });

            // Wechsel: auf eine andere wählbare Betriebsart; `full` noch einmal nur im Bestand.
            for (const target of MODES) {
              const available = target !== 'full' || fullSelectable;
              const expected = available && (target !== mode || legacy);
              expect(canSwitchTo(org, target)).toBe(expected);
            }

            // Ohne TSE in DE gibt es aus `full` keinen Weg zurück.
            expect(switchIsOneWay(org, 'cashless')).toBe(country === 'DE' && !tseActive && mode === 'full');
            expect(switchIsOneWay(org, 'full')).toBe(false);

            expect(certificateAvailable(org)).toBe(country === 'DE' && mode !== 'full');
            expect(legacyNoticeKind(org)).toBe(legacy ? (country === 'DE' ? 'de' : 'confirm') : null);
            expect(dashboardNoticeKind(org)).toBe(legacy && country === 'DE' ? 'legacy_de' : null);
            expect(operatingModeLabelValue(org)).toBe(legacy ? 'full_legacy' : mode);
          });
        }
      }
    }
  }
});

test.describe('operating mode', () => {
  test('without a valid value the legacy behaviour applies (full)', () => {
    expect(getOperatingMode(undefined)).toBe('full');
    expect(getOperatingMode({})).toBe('full');
    expect(getOperatingMode({ operatingMode: 'order_only' })).toBe('full');
    expect(getOperatingMode({ operatingMode: 'ORDERS_ONLY' })).toBe('full');
    expect(getOperatingMode({ operatingMode: 'orders_only' })).toBe('orders_only');
  });

  test('values from the API win over the fallback rule', () => {
    const org: OperatingModeOrg = { country: 'DE', operatingMode: 'full', operatingModeLegacy: false };
    expect(resolveOperatingMode(org).cashAllowed).toBe(false);
    expect(resolveOperatingMode({ ...org, cashAllowed: true }).cashAllowed).toBe(true);
    expect(resolveOperatingMode({ ...org, pricesVisible: false }).pricesVisible).toBe(false);
  });

  test('no organization yet: no cash, prices visible, no hint', () => {
    const view = resolveOperatingMode(undefined);
    expect(view.cashAllowed).toBe(false);
    expect(view.pricesVisible).toBe(true);
    expect(view.cashBlockedWithoutTse).toBe(false);
    expect(dashboardNoticeKind(undefined)).toBeNull();
  });

  test('without a country nothing can be chosen and the dashboard asks for it', () => {
    const legacy: OperatingModeOrg = { country: null, operatingMode: 'full', operatingModeLegacy: true };
    expect(operatingModeOptions(legacy).map((o) => o.unavailableReason)).toEqual([
      'country_required',
      'country_required',
      'country_required',
    ]);
    expect(canSwitchTo(legacy, 'cashless')).toBe(false);
    expect(dashboardNoticeKind(legacy)).toBe('set_country');
    // Bestand ohne Land wird wie Deutschland behandelt: deutlicher Hinweis.
    expect(legacyNoticeKind(legacy)).toBe('de');
    expect(resolveOperatingMode(legacy).cashAllowed).toBe(true);
    expect(countryNoticeKind(legacy)).toBeNull();
  });

  test('options from the API are used in fixed order', () => {
    const org: OperatingModeOrg = { country: 'DE', operatingMode: 'cashless' };
    const options = operatingModeOptions(org, [
      { mode: 'full', available: true, unavailableReason: null },
      { mode: 'orders_only', available: false, unavailableReason: 'country_required' },
    ]);
    expect(options.map((o) => o.mode)).toEqual(['orders_only', 'cashless', 'full']);
    expect(options[0].available).toBe(false);
    expect(options[1].available).toBe(true);
    expect(options[2].available).toBe(true);
  });

  test('country notices', () => {
    expect(countryNoticeKind({ country: 'de' })).toBe('de');
    expect(countryNoticeKind({ country: 'AT' })).toBe('at');
    expect(countryNoticeKind({ country: 'CH' })).toBe('ch');
    expect(countryNoticeKind({ country: 'IT' })).toBe('other');
  });

  test('"Tickets only" always sends (tab), never checks out immediately', () => {
    expect(effectiveOrderingMode('immediate', true)).toBe('tab');
    expect(effectiveOrderingMode(undefined, true)).toBe('tab');
    expect(effectiveOrderingMode(undefined, false)).toBe('immediate');
    expect(effectiveOrderingMode('tab', false)).toBe('tab');
    expect(effectiveOrderingMode('immediate', false)).toBe('immediate');
  });

  test('docs link per language', () => {
    expect(operatingModeDocsUrl('de')).toBe('https://docs.openeos.de/betriebsarten');
    expect(operatingModeDocsUrl('en')).toBe('https://docs.openeos.de/en/betriebsarten');
  });
});

test.describe('"Picked up" and "Close table"', () => {
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
  const de: OperatingModeOrg = { country: 'DE', operatingMode: 'cashless', operatingModeLegacy: false };

  test('needs another selectable mode and a reason of at least 5 characters', () => {
    expect(operatingModeSwitchError(de, 'cashless', 'Antrag vom 01.11.')).toBe('unchanged');
    expect(operatingModeSwitchError(de, 'full', 'Antrag vom 01.11.')).toBe('unavailable');
    expect(operatingModeSwitchError({ ...de, tseActive: true }, 'full', 'TSE ist aktiv')).toBeNull();
    expect(operatingModeSwitchError(de, 'orders_only', '  abc  ')).toBe('reasonTooShort');
    expect(operatingModeSwitchError(de, 'orders_only', 'x'.repeat(501))).toBe('reasonTooLong');
    expect(operatingModeSwitchError(de, 'orders_only', 'Antrag per E-Mail')).toBeNull();
  });

  test('legacy outside Germany can confirm "All features"', () => {
    const at: OperatingModeOrg = { country: 'AT', operatingMode: 'full', operatingModeLegacy: true };
    expect(operatingModeSwitchError(at, 'full', 'Bestätigt am Telefon')).toBeNull();
    expect(operatingModeSwitchError({ ...at, operatingModeLegacy: false }, 'full', 'Bestätigt')).toBe('unchanged');
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
    expect(stripped.hidePrices).toBe(true);
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

  test('prices only outside "Tickets only" and only for carts with prices', () => {
    expect(customerDisplayShowsPrices({ operatingMode: 'full' }, cart)).toBe(true);
    expect(customerDisplayShowsPrices({ operatingMode: 'cashless' }, cart)).toBe(true);
    expect(customerDisplayShowsPrices(undefined, null)).toBe(true);
    expect(customerDisplayShowsPrices({ operatingMode: 'orders_only' }, cart)).toBe(false);
    // Wert der API gewinnt
    expect(customerDisplayShowsPrices({ operatingMode: 'full', pricesVisible: false }, cart)).toBe(false);
    expect(customerDisplayShowsPrices({ operatingMode: 'full' }, { hidePrices: true })).toBe(false);
  });
});

test.describe('reports and dashboard without revenue', () => {
  const rows = [
    { name: 'Steak', qty: 2, amount: 30 },
    { name: 'Bier', qty: 10, amount: 40 },
    { name: 'Wasser', qty: 10, amount: 20 },
  ];

  test('"Tickets only" ranks by quantity, the other modes by revenue', () => {
    const qty = (r: (typeof rows)[number]) => r.qty;
    const amount = (r: (typeof rows)[number]) => r.amount;
    expect(rankByMode(rows, true, qty, amount).map((r) => r.name)).toEqual(['Bier', 'Wasser', 'Steak']);
    expect(rankByMode(rows, false, qty, amount).map((r) => r.name)).toEqual(['Bier', 'Steak', 'Wasser']);
    expect(rows[0].name).toBe('Steak');
  });
});
