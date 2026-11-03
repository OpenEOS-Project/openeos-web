import { expect, test } from '@playwright/test';

import {
  applyAmountKey,
  businessDateOf,
  cashDifference,
  centsInputToEuros,
  differenceTone,
  fallbackFilename,
  isValidRange,
  isValidTaxNumber,
  isValidVatId,
  missingMasterData,
  normalizeVatId,
  rangeIncludesToday,
  salesGrossCents,
  summaryRows,
  tipRecipientOf,
} from '@/lib/dsfinvk';
import { filenameFromDisposition } from '@/lib/api-client';

import { inTimeZone, TIME_ZONES } from './helpers';

test.describe('business day (6–6 Uhr, Berlin)', () => {
  for (const zone of TIME_ZONES) {
    test(`counts the night to the previous day in ${zone}`, () => {
      inTimeZone(zone, () => {
        // 03.11.2026 05:59 Berlin (Winterzeit, UTC+1) → noch der 02.11.
        expect(businessDateOf(new Date('2026-11-03T04:59:00Z'))).toBe('2026-11-02');
        // 06:00 Berlin → der 03.11.
        expect(businessDateOf(new Date('2026-11-03T05:00:00Z'))).toBe('2026-11-03');
        // Sommerzeit (UTC+2): 05:30 Berlin am 01.07. → 30.06.
        expect(businessDateOf(new Date('2026-07-01T03:30:00Z'))).toBe('2026-06-30');
        // Jahreswechsel
        expect(businessDateOf(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
      });
    });
  }

  test('ranges', () => {
    const now = new Date('2026-11-03T12:00:00Z');
    expect(rangeIncludesToday('2026-11-01', '2026-11-03', now)).toBe(true);
    expect(rangeIncludesToday('2026-11-01', '2026-11-02', now)).toBe(false);
    expect(isValidRange('2026-11-01', '2026-11-03')).toBe(true);
    expect(isValidRange('2026-11-04', '2026-11-03')).toBe(false);
    expect(isValidRange('', '2026-11-03')).toBe(false);
    expect(fallbackFilename('dsfinvk', '2026-11-03', '2026-11-03')).toBe('dsfinvk_2026-11-03.zip');
    expect(fallbackFilename('tse', '2026-11-01', '2026-11-03')).toBe('tse-export_2026-11-01_2026-11-03.zip');
  });
});

test.describe('tax details', () => {
  test('VAT ID: two letters and digits, uppercase without spaces', () => {
    expect(normalizeVatId(' de 123 456 789 ')).toBe('DE123456789');
    expect(isValidVatId('de123456789')).toBe(true);
    expect(isValidVatId('DE12345678')).toBe(false);
    expect(isValidVatId('ATU12345678')).toBe(true);
    expect(isValidVatId('123456789')).toBe(false);
    expect(isValidVatId('')).toBe(true);
  });

  test('tax number: 10–13 digits with separators', () => {
    expect(isValidTaxNumber('12/345/67890')).toBe(true);
    expect(isValidTaxNumber('2181508150')).toBe(true);
    expect(isValidTaxNumber('12/345')).toBe(false);
    expect(isValidTaxNumber('DE123456789')).toBe(false);
    expect(isValidTaxNumber('')).toBe(true);
  });

  test('missing master data like the API', () => {
    expect(missingMasterData({})).toEqual(['taxNumber', 'street', 'zip', 'city']);
    expect(
      missingMasterData({ vatId: 'DE123456789', contact: { address: 'Weg 1', zipCode: '12345', city: 'Ort' } }),
    ).toEqual([]);
    expect(missingMasterData({ taxNumber: '12/345/67890', contact: { address: ' ', city: 'Ort' } })).toEqual([
      'street',
      'zip',
    ]);
  });

  test('tip recipient defaults to the club', () => {
    expect(tipRecipientOf(undefined)).toBe('employer');
    expect(tipRecipientOf({ dsfinvk: { tipRecipient: 'employee' } })).toBe('employee');
  });
});

test.describe('cash book', () => {
  test('keypad input in cents', () => {
    expect(applyAmountKey('', '1')).toBe('1');
    expect(applyAmountKey('15', '00')).toBe('1500');
    expect(applyAmountKey('0', '5')).toBe('5');
    expect(applyAmountKey('1500', 'backspace')).toBe('150');
    expect(applyAmountKey('9999999', '9')).toBe('9999999');
    expect(centsInputToEuros('15000')).toBe(150);
    expect(centsInputToEuros('')).toBe(0);
  });

  test('difference counted − expected', () => {
    expect(cashDifference(150.1, 150.3)).toBe(-0.2);
    expect(differenceTone(cashDifference(150.1, 150.3))).toBe('minus');
    expect(differenceTone(cashDifference(160, 150))).toBe('plus');
    expect(differenceTone(cashDifference(0.3, 0.1 + 0.2))).toBe('zero');
  });

  test('summary rows show outflows negative', () => {
    const rows = summaryRows({
      openingBalance: 150,
      deposits: 50,
      withdrawals: -100,
      cashSales: 71.6,
      cashRefunds: -3,
      pfandPayouts: 2,
      differences: -0.5,
      expected: 170.1,
      lastCount: null,
    });
    expect(rows.map((r) => r.value)).toEqual([150, 50, -100, 71.6, -3, -2, -0.5]);
  });

  test('sales revenue leaves out cash movements, deposit and tips', () => {
    const line = (gvTyp: string, grossCents: number) => ({ gvTyp, gvName: '', vatKey: 1, grossCents, netCents: 0, vatCents: 0 });
    expect(
      salesGrossCents({
        byBusinessCase: [
          line('Umsatz', 2400),
          line('Umsatz', 760),
          line('Rabatt', -100),
          line('Pfand', 400),
          line('TrinkgeldAG', 100),
          line('Anfangsbestand', 15000),
          line('Geldtransit', -10000),
          line('DifferenzSollIst', -50),
        ],
      }),
    ).toBe(3060);
  });

  test('filename from Content-Disposition', () => {
    expect(filenameFromDisposition('attachment; filename="dsfinvk_Z1-Z3.zip"')).toBe('dsfinvk_Z1-Z3.zip');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''kasse%20a.zip")).toBe('kasse a.zip');
    expect(filenameFromDisposition(null)).toBeNull();
  });
});
