import { expect, test } from '@playwright/test';

import { INTEGRATIONS, integrationAvailability } from '@/config/integrations';
import {
  formatBytes,
  isV0QrPayload,
  outageFromViews,
  percentOf,
  posTseState,
  processDataTotal,
  receiptTseViews,
  shortSerial,
  tseNoticeKind,
  tseSetupStep,
} from '@/lib/tse';
import type { TseReceiptView, TseStatus, TseUnit } from '@/types/tse';
import { generateTemplate } from '@/app/[locale]/(dashboard)/printers/templates/[id]/utils/template-generator';

const unit = (state: TseUnit['state'], extra: Partial<TseUnit> = {}): TseUnit => ({
  id: 'u1',
  provider: 'swissbit',
  state,
  serialNumber: '2d38954f7b7307eb0f90abe12fc4c75fb0e67c51528a47e39f3690b4b9fb162a',
  clientId: 'OEOS-2BDA366D6B8D',
  productType: '850007',
  trigger: 'manual',
  triggerEventId: null,
  createdAt: '2026-11-03T15:00:00.000Z',
  activatedAt: state === 'active' ? '2026-11-03T15:01:00.000Z' : null,
  failedAt: null,
  deactivatedAt: null,
  deactivationReason: null,
  certificationId: null,
  certificateExpiresAt: null,
  signatureAlgorithm: 'ecdsa-plain-SHA256',
  logTimeFormat: 'unixTime',
  publicKey: null,
  lastError: null,
  ...extra,
});

const status = (extra: Partial<TseStatus> = {}): TseStatus => ({
  available: true,
  integrationEnabled: true,
  lifecycle: 'persistent',
  country: 'DE',
  eligibility: { ok: true, reason: null, availableFrom: null, event: null },
  unit: null,
  live: null,
  liveError: null,
  outage: null,
  counts: null,
  exports: { lastDownloadedAt: null, pending: 0 },
  history: [],
  ...extra,
});

const view = (extra: Partial<TseReceiptView> = {}): TseReceiptView => ({
  id: 't1',
  kind: 'receipt',
  status: 'signed',
  training: false,
  notice: null,
  processType: 'Kassenbeleg-V1',
  processData: 'Beleg^9.00_3.50_0.00_0.00_0.00^12.50:Bar',
  serialNumber: 'abc',
  clientId: 'OEOS-2BDA366D6B8D',
  transactionNumber: 82,
  signatureCounter: 179,
  startTime: '2026-11-03T15:59:50.000Z',
  finishTime: '2026-11-03T15:59:50.000Z',
  signatureValue: 'sig',
  signatureAlgorithm: 'ecdsa-plain-SHA256',
  logTimeFormat: 'unixTime',
  publicKey: 'pk',
  qrCode: 'V0;OEOS-2BDA366D6B8D;Kassenbeleg-V1;Beleg^9.00_3.50_0.00_0.00_0.00^12.50:Bar;82;179;a;b;c;d;sig;pk',
  errorCode: null,
  terminal: null,
  createdAt: '2026-11-03T15:59:50.000Z',
  ...extra,
});

test.describe('Cloud-TSE setup step', () => {
  test('follows the unit state first', () => {
    expect(tseSetupStep(status({ unit: unit('active') }))).toBe('active');
    expect(tseSetupStep(status({ unit: unit('creating') }))).toBe('creating');
    expect(tseSetupStep(status({ unit: unit('failed') }))).toBe('failed');
  });

  test('explains missing requirements', () => {
    expect(tseSetupStep(status({ available: false }))).toBe('unavailable');
    expect(tseSetupStep(status({ country: 'AT' }))).toBe('country');
    expect(
      tseSetupStep(
        status({ eligibility: { ok: false, reason: 'TSE_REQUIRES_PAID_EVENT', availableFrom: null, event: null } }),
      ),
    ).toBe('paid_event_required');
    expect(
      tseSetupStep(
        status({
          eligibility: {
            ok: false,
            reason: 'TSE_TOO_EARLY',
            availableFrom: '2026-12-01',
            event: { id: 'e', name: 'Weihnachtsmarkt', startDate: '2026-12-12T15:00:00.000Z' },
          },
        }),
      ),
    ).toBe('too_early');
    expect(tseSetupStep(status())).toBe('ready');
  });

  test('a deactivated TSE can be replaced once a paid event qualifies', () => {
    const deactivated = unit('deactivated', { deactivatedAt: '2026-11-03T16:00:00.000Z' });
    expect(tseSetupStep(status({ unit: deactivated }))).toBe('ready');
    expect(
      tseSetupStep(
        status({
          unit: deactivated,
          eligibility: { ok: false, reason: 'TSE_REQUIRES_PAID_EVENT', availableFrom: null, event: null },
        }),
      ),
    ).toBe('deactivated');
  });
});

test.describe('Cloud-TSE helpers', () => {
  test('shortens serial numbers for tables', () => {
    expect(shortSerial('2d38954f7b7307eb0f90abe12fc4c75fb0e67c51528a47e39f3690b4b9fb162a')).toBe('2d38954f…162a');
    expect(shortSerial(null)).toBe('–');
    expect(shortSerial('short')).toBe('short');
  });

  test('formats storage and percentages', () => {
    expect(formatBytes(26214400, 'de')).toBe('25 MB');
    expect(formatBytes(6144, 'en')).toBe('6 KB');
    expect(percentOf(6144, 26214400)).toBe(0);
    expect(percentOf(13107200, 26214400)).toBe(50);
    expect(percentOf(null, 10)).toBeNull();
  });

  test('reads the paid amount from process data', () => {
    expect(processDataTotal('Kassenbeleg-V1', 'Beleg^9.00_3.50_0.00_0.00_0.00^12.50:Bar')).toBe(12.5);
    expect(processDataTotal('Kassenbeleg-V1', 'AVTraining^1.00_0.00_0.00_0.00_0.00^0.50:Bar_0.50:Unbar')).toBe(1);
    expect(processDataTotal('Kassenbeleg-V1', 'Beleg^0.00_0.00_0.00_0.00_-0.50^-0.50:Bar')).toBe(-0.5);
    expect(processDataTotal('Bestellung-V1', '2;"Bier";4.50')).toBeNull();
  });

  test('keeps only receipts, without duplicates', () => {
    const order = view({ id: 'o', kind: 'order', processType: 'Bestellung-V1' });
    const receipt = view();
    expect(receiptTseViews([order, receipt, null, receipt]).map((v) => v.id)).toEqual(['t1']);
  });

  test('marks failed and training receipts', () => {
    expect(tseNoticeKind(view())).toBeNull();
    expect(tseNoticeKind(view({ status: 'failed' }))).toBe('failed');
    expect(tseNoticeKind(view({ status: 'pending' }))).toBe('failed');
    expect(tseNoticeKind(view({ status: 'training', training: true }))).toBe('training');
  });

  test('outage hint follows the last transaction', () => {
    expect(outageFromViews(false, [view({ status: 'failed' })])).toBe(true);
    expect(outageFromViews(true, [view()])).toBe(false);
    expect(outageFromViews(true, [])).toBe(true);
    expect(outageFromViews(false, [view(), view({ status: 'failed' })])).toBe(true);
  });

  test('accepts only V0 QR payloads', () => {
    expect(isV0QrPayload(view().qrCode)).toBe(true);
    expect(isV0QrPayload('V1;x')).toBe(false);
    expect(isV0QrPayload(null)).toBe(false);
  });
});

test.describe('integration availability', () => {
  const tse = INTEGRATIONS.find((i) => i.id === 'tse')!;

  test('Cloud-TSE only for German organizations on servers that offer it', () => {
    expect(integrationAvailability(tse, { country: 'DE', tse: null })).toBe('available');
    expect(integrationAvailability(tse, { country: 'at' })).toBe('country');
    expect(integrationAvailability(tse, { country: null })).toBe('country');
    expect(
      integrationAvailability(tse, {
        country: 'DE',
        tse: { available: false, integrationEnabled: false, active: false, state: null, serialNumber: null, clientId: null },
      }),
    ).toBe('server');
  });

  test('switching off is blocked while a TSE is set up', () => {
    const summary = { available: true, integrationEnabled: true, active: true, state: 'active' as const, serialNumber: 'x', clientId: 'y' };
    expect(tse.deactivateBlocked?.({ tse: summary })).toBe(true);
    expect(tse.deactivateBlocked?.({ tse: { ...summary, state: 'creating', active: false } })).toBe(true);
    expect(tse.deactivateBlocked?.({ tse: { ...summary, state: 'deactivated', active: false } })).toBe(false);
  });

  test('SumUp stays available everywhere', () => {
    const sumup = INTEGRATIONS.find((i) => i.id === 'sumup')!;
    expect(integrationAvailability(sumup, { country: 'AT' })).toBe('available');
  });
});

test.describe('POS TSE pill', () => {
  test('hidden without the integration', () => {
    expect(posTseState(null, false)).toBeNull();
    expect(posTseState(undefined, true)).toBeNull();
  });

  test('follows the server state', () => {
    expect(posTseState({ state: 'ok' }, false)).toBe('ok');
    expect(posTseState({ state: 'creating' }, false)).toBe('creating');
    expect(posTseState({ state: 'inactive' }, false)).toBe('inactive');
    expect(posTseState({ state: 'error' }, false)).toBe('error');
  });

  test('an unsigned transaction of this till turns it red before the server reports it', () => {
    expect(posTseState({ state: 'ok' }, true)).toBe('error');
  });
});

test.describe('receipt designer', () => {
  test('prints the payment label from the API, raw method as fallback', () => {
    const source = generateTemplate({
      paperWidth: 80,
      elements: [{ id: 'e1', type: 'field', field: 'payment_method', condition: 'payment_method' }],
    });
    expect(source).toContain('Zahlungsart: {{ payment_label|default(payment_method) }}');
    expect(source).not.toMatch(/\{\{\s*payment_method\s*\}\}/);
  });
});
