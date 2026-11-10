import { expect, test } from '@playwright/test';

import { INTEGRATIONS, integrationAvailability } from '@/config/integrations';
import {
  formatBytes,
  isTseComingSoon,
  isV0QrPayload,
  outageFromViews,
  percentOf,
  quotedEventNames,
  processDataTotal,
  receiptTseViews,
  shortSerial,
  tseDeactivationParts,
  tseHint,
  tseKeepLines,
  tseMonthLabel,
  tseNoticeKind,
  tseRequirements,
  tseEventCheckFromEligibility,
  tseEventCheckFromEvents,
  tseSetupStep,
  tseSetupStepFrom,
  tseUnlockCandidate,
  type TseSetupInput,
  type TseSetupStep,
} from '@/lib/tse';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
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
  eligibility: {
    ok: true,
    reason: null,
    availableFrom: null,
    event: { id: 'e', name: 'Sommerfest', startDate: '2026-11-16T09:00:00.000Z' },
  },
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
    expect(tseSetupStep(status({ available: false, availability: 'not_configured' }))).toBe('unavailable');
    // Gehostet ohne Swissbit-Vertrag (TSE_COMING_SOON): „Bald verfügbar“.
    expect(tseSetupStep(status({ available: false, availability: 'coming_soon' }))).toBe('coming_soon');
    expect(tseSetupStep(status({ country: null }))).toBe('country_missing');
    expect(tseSetupStep(status({ country: ' ' }))).toBe('country_missing');
    expect(tseSetupStep(status({ country: 'AT' }))).toBe('country');
    expect(
      tseSetupStep(
        status({
          integrationEnabled: false,
          eligibility: { ok: false, reason: 'INTEGRATION_DISABLED', availableFrom: null, event: null },
        }),
      ),
    ).toBe('integration_disabled');
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
    expect(
      tseSetupStep(
        status({
          eligibility: {
            ok: false,
            reason: 'TSE_MASTER_DATA_REQUIRED',
            availableFrom: null,
            event: null,
            missing: ['taxNumber', 'city'],
          },
        }),
      ),
    ).toBe('master_data');
    expect(tseSetupStep(status())).toBe('ready');
  });

  test('names the blocker with the most useful next action first', () => {
    const input = (extra: Partial<TseSetupInput> = {}): TseSetupInput => ({
      available: true,
      integrationEnabled: true,
      country: 'DE',
      events: { event: { id: 'e', name: 'Sommerfest', startDate: '2026-11-16T10:00:00.000Z' }, availableFrom: null },
      masterDataMissing: [],
      unitState: null,
      ...extra,
    });
    // Staging (Tour-Test): kein Land, Integration aus, keine Veranstaltung.
    expect(tseSetupStepFrom(input({ country: null, integrationEnabled: false, events: { event: null, availableFrom: null } }))).toBe(
      'country_missing',
    );
    expect(tseSetupStepFrom(input({ available: false, country: null }))).toBe('unavailable');
    expect(tseSetupStepFrom(input({ available: false, comingSoon: true, country: null }))).toBe('coming_soon');
    // Verfügbar schlägt angekündigt.
    expect(tseSetupStepFrom(input({ available: true, comingSoon: true }))).not.toBe('coming_soon');
    // Ohne bezahlte Veranstaltung nützt Einschalten allein nichts.
    expect(tseSetupStepFrom(input({ integrationEnabled: false, events: { event: null, availableFrom: null } }))).toBe(
      'paid_event_required',
    );
    // Staging (KjG): Deutschland, bezahlte Veranstaltung, Integration aus.
    expect(tseSetupStepFrom(input({ integrationEnabled: false }))).toBe('integration_disabled');
    // Integration aus, Veranstaltungen noch nicht geladen: Schalter reicht als Grund.
    expect(tseSetupStepFrom(input({ integrationEnabled: false, events: undefined }))).toBe('integration_disabled');
    expect(tseSetupStepFrom(input({ events: undefined }))).toBeNull();
    // Stammdaten (DSFinV-K) nach dem Schalter, vor dem Monat.
    expect(tseSetupStepFrom(input({ masterDataMissing: ['taxNumber'] }))).toBe('master_data');
    expect(tseSetupStepFrom(input({ masterDataMissing: ['city'], events: undefined }))).toBe('master_data');
    expect(tseSetupStepFrom(input({ integrationEnabled: false, masterDataMissing: ['city'] }))).toBe('integration_disabled');
    expect(
      tseSetupStepFrom(input({ masterDataMissing: ['city'], events: { event: null, availableFrom: null } })),
    ).toBe('paid_event_required');
    expect(tseSetupStepFrom(input({ events: { event: input().events!.event, availableFrom: '2026-12-01' } }))).toBe('too_early');
    expect(tseSetupStepFrom(input())).toBe('ready');
    expect(tseSetupStepFrom(input({ available: false, country: null, unitState: 'active' }))).toBe('active');
  });

  test('a failed setup can be retried only while the requirements hold', () => {
    expect(tseSetupStep(status({ unit: unit('failed') }))).toBe('failed');
    expect(
      tseSetupStep(
        status({
          unit: unit('failed'),
          eligibility: { ok: false, reason: 'TSE_REQUIRES_PAID_EVENT', availableFrom: null, event: null },
        }),
      ),
    ).toBe('paid_event_required');
  });

  test('a deactivated TSE shows what a new one still needs', () => {
    const deactivated = unit('deactivated', { deactivatedAt: '2026-11-03T16:00:00.000Z' });
    expect(tseSetupStep(status({ unit: deactivated }))).toBe('ready');
    expect(
      tseSetupStep(
        status({
          unit: deactivated,
          eligibility: { ok: false, reason: 'TSE_REQUIRES_PAID_EVENT', availableFrom: null, event: null },
        }),
      ),
    ).toBe('paid_event_required');
  });
});

test.describe('Cloud-TSE paid event check', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');
  const ev = (id: string, startDate: string | null, billingStatus: string, endDate: string | null = null) => ({
    id,
    name: id,
    startDate,
    endDate,
    billingStatus,
  });

  test('takes the API answer only where the API checked', () => {
    expect(tseEventCheckFromEligibility({ ok: false, reason: 'INTEGRATION_DISABLED', availableFrom: null, event: null })).toBeUndefined();
    expect(tseEventCheckFromEligibility({ ok: false, reason: 'TSE_REQUIRES_PAID_EVENT', availableFrom: null, event: null })).toEqual({
      event: null,
      availableFrom: null,
    });
    const event = { id: 'e', name: 'Fest', startDate: '2026-12-12T15:00:00.000Z' };
    expect(tseEventCheckFromEligibility({ ok: false, reason: 'TSE_TOO_EARLY', availableFrom: '2026-12-01', event })).toEqual({
      event,
      availableFrom: '2026-12-01',
    });
    expect(tseEventCheckFromEligibility({ ok: true, reason: null, availableFrom: null, event })).toEqual({ event, availableFrom: null });
  });

  test('mirrors the API rule from the event list', () => {
    const events = [
      ev('past', '2026-09-11T22:00:00.000Z', 'paid', '2026-09-12T22:00:00.000Z'),
      ev('unpaid', '2026-11-10T10:00:00.000Z', 'none'),
      ev('december', '2026-12-12T15:00:00.000Z', 'invoice'),
      ev('november', '2026-11-16T09:00:00.000Z', 'paid'),
    ];
    expect(tseEventCheckFromEvents(events, { selfHosted: false, now })).toEqual({
      event: { id: 'november', name: 'november', startDate: '2026-11-16T09:00:00.000Z' },
      availableFrom: null,
    });
    // Erst im Dezember: ab dem 1. Dezember (Berlin).
    expect(tseEventCheckFromEvents([events[2]], { selfHosted: false, now }).availableFrom).toBe('2026-12-01');
    // 30.11. 23:30 UTC ist in Berlin schon Dezember.
    expect(
      tseEventCheckFromEvents([ev('nye', '2026-11-30T23:30:00.000Z', 'waived')], { selfHosted: false, now }).availableFrom,
    ).toBe('2026-12-01');
    expect(tseEventCheckFromEvents([events[0], events[1]], { selfHosted: false, now }).event).toBeNull();
    // Eigene Installation: keine Abrechnung, jede Veranstaltung zählt.
    expect(tseEventCheckFromEvents([events[1]], { selfHosted: true, now }).event?.id).toBe('unpaid');
  });

  test('offers the next event that can still be unlocked', () => {
    expect(
      tseUnlockCandidate(
        [ev('past', '2026-09-11T22:00:00.000Z', 'none', '2026-09-12T22:00:00.000Z'), ev('later', '2026-12-01T10:00:00.000Z', 'none'), ev('soon', '2026-11-20T10:00:00.000Z', 'pending')],
        now,
      )?.id,
    ).toBe('soon');
    expect(tseUnlockCandidate([ev('paid', '2026-11-20T10:00:00.000Z', 'paid')], now)).toBeNull();
  });
});

test.describe('Cloud-TSE reason → message', () => {
  const steps: TseSetupStep[] = [
    'unavailable',
    'coming_soon',
    'country_missing',
    'country',
    'paid_event_required',
    'integration_disabled',
    'master_data',
    'too_early',
    'failed',
    'ready',
    'creating',
    'active',
  ];

  test('maps every blocker to its message and direct action', () => {
    expect(tseHint('country_missing')).toEqual({ key: 'countryMissing', tone: 'warn', action: 'set_country' });
    expect(tseHint('country')).toEqual({ key: 'countryUnsupported', tone: 'info', action: null });
    expect(tseHint('unavailable')).toEqual({ key: 'unavailable', tone: 'info', action: null });
    expect(tseHint('coming_soon')).toEqual({ key: 'comingSoon', tone: 'info', action: null });
    expect(tseHint('paid_event_required')).toEqual({ key: 'paidEventRequired', tone: 'warn', action: 'unlock_event' });
    expect(tseHint('integration_disabled')).toEqual({ key: 'integrationDisabled', tone: 'info', action: 'enable' });
    expect(tseHint('master_data')).toEqual({ key: 'masterData', tone: 'warn', action: 'master_data' });
    expect(tseHint('too_early')).toEqual({ key: 'tooEarly', tone: 'info', action: null });
    expect(tseHint('ready')).toEqual({ key: 'ready', tone: 'ok', action: 'setup' });
    expect(tseHint('failed')).toEqual({ key: 'failed', tone: 'danger', action: 'retry' });
  });

  test('every message exists in German and English, short and long', () => {
    for (const messages of [de, en]) {
      const hints = messages.integrations.tse.hint as unknown as Record<string, Record<string, string>>;
      for (const step of steps) {
        const { key, action } = tseHint(step);
        for (const field of ['short', 'title', 'text']) expect(hints[key]?.[field], `${key}.${field}`).toBeTruthy();
        if (action && action !== 'unlock_event') {
          expect(hints[key]?.action, `${key}.action`).toBeTruthy();
        }
      }
      expect(hints.paidEventRequired.actionUnlock).toContain('{name}');
      expect(hints.paidEventRequired.actionCreate).toBeTruthy();
    }
  });

  test('German copy names the concrete reason', () => {
    const hints = de.integrations.tse.hint;
    expect(hints.countryMissing.title).toBe('Lege zuerst das Land deiner Organisation fest');
    expect(hints.countryUnsupported.title).toBe('Nur für Deutschland');
    expect(hints.unavailable.title).toBe('Auf diesem Server nicht eingerichtet');
    expect(hints.comingSoon.title).toBe('Bald verfügbar');
    expect(hints.comingSoon.short).toBe(
      'Die Cloud-TSE für Barzahlungen in Deutschland kommt in Kürze. Bis dahin kannst du „Nur Bons“ oder „Bargeldlos“ nutzen.',
    );
    expect(hints.paidEventRequired.text).toContain(
      'Die Cloud-TSE wird mit deiner ersten bezahlten Veranstaltung eingerichtet',
    );
    expect(hints.integrationDisabled.short).toBe('Ausgeschaltet – einschalten, dann wird die TSE eingerichtet');
    expect(hints.tooEarly.title).toBe('Ab {date} möglich (Monat der Veranstaltung)');
    expect(hints.tooEarly.text).toContain('{name}');
    expect(hints.ready.action).toBe('Jetzt einrichten');
  });

  test('checklist: ✓ for what holds, • for what is open, the blocker highlighted', () => {
    const base: TseSetupInput = {
      available: true,
      integrationEnabled: false,
      country: 'DE',
      events: { event: { id: 'e', name: 'Fest', startDate: '2026-11-16T09:00:00.000Z' }, availableFrom: null },
      masterDataMissing: [],
      unitState: null,
    };
    const view = (input: TseSetupInput) => {
      const step = tseSetupStepFrom(input)!;
      return tseRequirements(input, step).map((r) => `${r.id}:${r.ok ? 'ok' : r.current ? 'current' : 'open'}`);
    };
    // KjG: Land ✓, Veranstaltung ✓, Integration • (hier hängt es), Einrichtung •.
    expect(view(base)).toEqual(['country:ok', 'masterData:ok', 'paidEvent:ok', 'integration:current', 'setup:open']);
    expect(view({ ...base, country: null, events: { event: null, availableFrom: null } })).toEqual([
      'country:current',
      'masterData:ok',
      'paidEvent:open',
      'integration:open',
      'setup:open',
    ]);
    expect(view({ ...base, events: { event: null, availableFrom: null } })).toEqual([
      'country:ok',
      'masterData:ok',
      'paidEvent:current',
      'integration:open',
      'setup:open',
    ]);
    expect(view({ ...base, integrationEnabled: true })).toEqual([
      'country:ok',
      'masterData:ok',
      'paidEvent:ok',
      'integration:ok',
      'setup:current',
    ]);
    expect(view({ ...base, integrationEnabled: true, masterDataMissing: ['taxNumber'] })).toEqual([
      'country:ok',
      'masterData:current',
      'paidEvent:ok',
      'integration:ok',
      'setup:open',
    ]);
    expect(view({ ...base, integrationEnabled: true, unitState: 'active' })).toEqual([
      'country:ok',
      'masterData:ok',
      'paidEvent:ok',
      'integration:ok',
      'setup:ok',
    ]);
    // Der Server erscheint nur, wenn er fehlt.
    expect(view({ ...base, available: false })[0]).toBe('server:current');
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
    expect(integrationAvailability(tse, { country: null })).toBe('countryMissing');
    expect(
      integrationAvailability(tse, {
        country: 'DE',
        tse: { available: false, integrationEnabled: false, active: false, state: null, serialNumber: null, clientId: null },
      }),
    ).toBe('server');
  });

  test('coming soon (hosted, TSE_COMING_SOON): „Bald verfügbar“ instead of „not on this server“', () => {
    const soon = {
      available: false,
      availability: 'coming_soon' as const,
      integrationEnabled: false,
      active: false,
      state: null,
      serialNumber: null,
      clientId: null,
    };
    expect(integrationAvailability(tse, { country: 'DE', tse: soon })).toBe('comingSoon');
    expect(integrationAvailability(tse, { country: null, tse: soon })).toBe('comingSoon');
    // Außerhalb Deutschlands kommt sie auch dann nicht.
    expect(integrationAvailability(tse, { country: 'AT', tse: soon })).toBe('country');
    // Eigene Installation ohne Provider (kein coming_soon): unverändert.
    expect(
      integrationAvailability(tse, { country: 'DE', tse: { ...soon, availability: 'not_configured' } }),
    ).toBe('server');
    expect(isTseComingSoon(soon)).toBe(true);
    expect(isTseComingSoon({ availability: 'available' })).toBe(false);
    expect(isTseComingSoon(null)).toBe(false);
    for (const messages of [de, en]) {
      expect(messages.integrations.tse.comingSoonHint).toBeTruthy();
      expect(messages.integrations.tse.setup.check.serverComingSoon).toBeTruthy();
    }
    expect(de.integrations.tse.comingSoonHint).toContain('„Nur Bons“ oder „Bargeldlos“');
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

test.describe('Folgemonat schon gebucht (Prognose der Abmeldung)', () => {
  const now = new Date('2026-11-06T10:00:00.000Z');

  test('Monatsname mit Jahr nur, wenn es nicht das laufende Jahr ist', () => {
    expect(tseMonthLabel('2026-12', 'de-DE', now)).toBe('Dezember');
    expect(tseMonthLabel('2027-01', 'de-DE', now)).toBe('Januar 2027');
    expect(tseMonthLabel('2026-12', 'en-GB', now)).toBe('December');
  });

  test('Termin lang in Berliner Zeit (auch im UTC-Browser)', () => {
    expect(tseDeactivationParts('2026-12-31T19:00:00.000Z', 'de-DE')).toEqual({
      date: '31. Dezember 2026',
      time: '20:00',
    });
    // Sommerzeit: 20:00 Berlin = 18:00 UTC
    expect(tseDeactivationParts('2027-03-31T18:00:00.000Z', 'de-DE').time).toBe('20:00');
  });

  test('Veranstaltungsnamen in Anführungszeichen, als Aufzählung', () => {
    expect(quotedEventNames(['Weihnachtsmarkt'], 'de-DE')).toBe('„Weihnachtsmarkt“');
    expect(quotedEventNames(['A', 'B'], 'de-DE')).toBe('„A“ und „B“');
  });

  test('Zeilen je Monat, Namen ohne Doppelte; ohne Prognose keine', () => {
    expect(tseKeepLines(null)).toEqual([]);
    expect(
      tseKeepLines({
        expectedDeactivationAt: '2027-01-31T19:00:00.000Z',
        months: [
          {
            month: '2026-12',
            reason: 'paid_event_next_month',
            decided: true,
            events: [
              { id: '1', name: 'Weihnachtsmarkt', startDate: '2026-12-12T14:00:00.000Z', endDate: null },
              { id: '2', name: 'Weihnachtsmarkt', startDate: '2026-12-13T14:00:00.000Z', endDate: null },
            ],
          },
          {
            month: '2027-01',
            reason: 'paid_event_running',
            decided: false,
            events: [{ id: '3', name: 'Winterdorf', startDate: '2026-12-28T09:00:00.000Z', endDate: null }],
          },
        ],
      })
    ).toEqual([
      { month: '2026-12', reason: 'paid_event_next_month', decided: true, events: ['Weihnachtsmarkt'] },
      { month: '2027-01', reason: 'paid_event_running', decided: false, events: ['Winterdorf'] },
    ]);
  });
});
