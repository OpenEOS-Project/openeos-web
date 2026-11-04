import { currentPostponement, isMonthlyDeactivation, overdueUnits } from '@/lib/tse';
import { missingForCheckout, parseMissingParam, validatePurchaseMasterData } from '@/utils/purchase-master-data';
import { expect, test } from '@playwright/test';

import type { EventTseTerms, PurchaseMasterDataStatus, PurchaseMasterDataValues } from '@/types/billing';

const terms = (offer: EventTseTerms['offer']): EventTseTerms => ({
  offer,
  surcharge: 0,
  missing: [],
  included: null,
  surchargeCharged: null,
});

const status: PurchaseMasterDataStatus = {
  values: { legalName: '', street: '', zip: '', city: '', taxNumber: '', vatId: '' },
  missing: ['legalName', 'street', 'zip', 'city'],
  missingWithTse: ['legalName', 'street', 'zip', 'city', 'taxNumber'],
  country: 'DE',
};

const values = (overrides: Partial<PurchaseMasterDataValues> = {}): PurchaseMasterDataValues => ({
  legalName: 'MV Harmonie e.V.',
  street: 'Hauptstr. 1',
  zip: '12345',
  city: 'Musterstadt',
  taxNumber: '',
  vatId: '',
  ...overrides,
});

test.describe('Pflichtangaben beim Kauf', () => {
  test('mit Cloud-TSE („Alle Funktionen“ oder Bestand mit „Ja“) auch die Steuernummer', () => {
    expect(missingForCheckout(status, terms('included'), null)).toContain('taxNumber');
    expect(missingForCheckout(status, terms('optional'), null)).not.toContain('taxNumber');
    expect(missingForCheckout(status, terms('optional'), false)).not.toContain('taxNumber');
    expect(missingForCheckout(status, terms('optional'), true)).toContain('taxNumber');
    expect(missingForCheckout(status, terms(null), true)).not.toContain('taxNumber');
  });

  test('ältere API ohne masterData: nichts fehlt', () => {
    expect(missingForCheckout(undefined, terms('included'), null)).toEqual([]);
  });

  test('params.missing aus der API lesen', () => {
    expect(parseMissingParam('legalName,taxNumber,unknown')).toEqual(['legalName', 'taxNumber']);
    expect(parseMissingParam(undefined)).toEqual([]);
  });

  test('Formular: Name und Anschrift immer, Steuernummer nur mit TSE, Format DE', () => {
    expect(validatePurchaseMasterData(values(), { withTse: false, country: 'DE' })).toEqual({});
    expect(validatePurchaseMasterData(values({ legalName: ' ' }), { withTse: false, country: 'DE' })).toEqual({
      legalName: 'required',
    });
    expect(validatePurchaseMasterData(values(), { withTse: true, country: 'DE' })).toEqual({ taxNumber: 'taxRequired' });
    expect(validatePurchaseMasterData(values({ taxNumber: '123' }), { withTse: true, country: 'DE' })).toEqual({
      taxNumber: 'taxNumberInvalid',
    });
    expect(validatePurchaseMasterData(values({ vatId: 'DE12' }), { withTse: true, country: 'DE' })).toEqual({
      vatId: 'vatIdInvalid',
    });
    expect(validatePurchaseMasterData(values({ vatId: 'de 123456789' }), { withTse: true, country: 'DE' })).toEqual({});
    expect(validatePurchaseMasterData(values({ taxNumber: '12/345/67890' }), { withTse: true, country: 'DE' })).toEqual(
      {}
    );
  });
});

test.describe('Cloud-TSE: Abmeldung zum Monatsende', () => {
  const postponement = {
    at: '2026-11-30T19:00:00.000Z',
    from: '2026-11-30T19:00:00.000Z',
    to: '2026-12-31T19:00:00.000Z',
    reason: 'paid_event_running' as const,
    extraMonth: '2026-12',
    events: [{ id: 'e1', name: 'Nikolausparty', startDate: '2026-11-30T17:00:00.000Z', endDate: null }],
  };

  test('aktuelle Verschiebung nur, wenn sie zum Termin passt', () => {
    expect(
      currentPostponement({ plannedDeactivationAt: '2026-12-31T19:00:00.000Z', postponements: [postponement] })
    ).toEqual(postponement);
    expect(
      currentPostponement({ plannedDeactivationAt: '2027-01-31T19:00:00.000Z', postponements: [postponement] })
    ).toBeNull();
    expect(currentPostponement({ plannedDeactivationAt: null, postponements: [] })).toBeNull();
  });

  test('Abmeldegrund und überfällige TSEs', () => {
    expect(isMonthlyDeactivation('monthly_cycle')).toBe(true);
    expect(isMonthlyDeactivation('per_event_cycle')).toBe(true);
    expect(isMonthlyDeactivation('manual')).toBe(false);
    expect(overdueUnits([{ deactivationOverdue: true }, { deactivationOverdue: false }])).toHaveLength(1);
  });
});
