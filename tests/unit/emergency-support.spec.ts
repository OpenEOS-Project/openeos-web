import { expect, test } from '@playwright/test';

import { emergencyPhoneFor, showEmergencyAtPos, showEmergencyForEvents } from '@/lib/emergency-support';

/** Fest 16.–17.11.2026: echt ab 15.11. 18:00 bis 18.11. 12:00 (Berlin). */
const fest = {
  id: 'e1',
  status: 'active' as const,
  phase: 'planned' as const,
  realSalesFrom: '2026-11-15T17:00:00.000Z',
  realSalesUntil: '2026-11-18T11:00:00.000Z',
};
const info = { phone: '+49 15678 142392', telUri: 'tel:+4915678142392', eventIds: ['e1'] };
const none = { phone: null, telUri: null, eventIds: [] };
const at = (iso: string) => Date.parse(iso);

test.describe('emergencyPhoneFor (Support-Bereich)', () => {
  test('nur mit Nummer der API', () => {
    expect(emergencyPhoneFor(info)).toBe(info);
    expect(emergencyPhoneFor(none)).toBeNull();
    expect(emergencyPhoneFor(undefined)).toBeNull();
  });
});

test.describe('showEmergencyForEvents (Dashboard, Veranstaltungen)', () => {
  test('geplant und aktiv: ja', () => {
    expect(showEmergencyForEvents(info, [fest], at('2026-11-10T12:00:00Z'))).toBe(true);
    expect(showEmergencyForEvents(info, [fest], at('2026-11-16T20:00:00Z'))).toBe(true);
  });

  test('nach Ende und Kulanz: nein', () => {
    expect(showEmergencyForEvents(info, [fest], at('2026-11-18T11:00:00Z'))).toBe(false);
  });

  test('ohne Nummer, ohne gebuchte Veranstaltung oder im Testmodus: nein', () => {
    expect(showEmergencyForEvents(none, [fest], at('2026-11-16T20:00:00Z'))).toBe(false);
    expect(showEmergencyForEvents({ ...info, eventIds: ['other'] }, [fest], at('2026-11-16T20:00:00Z'))).toBe(false);
    expect(
      showEmergencyForEvents(info, [{ ...fest, status: 'test', phase: 'test' }], at('2026-11-16T20:00:00Z')),
    ).toBe(false);
    expect(showEmergencyForEvents(info, [], at('2026-11-16T20:00:00Z'))).toBe(false);
  });
});

test.describe('showEmergencyAtPos (Kassenmenü)', () => {
  test('nur während die Veranstaltung echt verkauft', () => {
    expect(showEmergencyAtPos(info, fest, at('2026-11-10T12:00:00Z'))).toBe(false);
    expect(showEmergencyAtPos(info, fest, at('2026-11-16T20:00:00Z'))).toBe(true);
    expect(showEmergencyAtPos(info, fest, at('2026-11-18T11:00:00Z'))).toBe(false);
  });

  test('nicht für eine andere Veranstaltung und nicht ohne Nummer', () => {
    expect(showEmergencyAtPos(info, { ...fest, id: 'e2' }, at('2026-11-16T20:00:00Z'))).toBe(false);
    expect(showEmergencyAtPos(none, fest, at('2026-11-16T20:00:00Z'))).toBe(false);
    expect(showEmergencyAtPos(info, null)).toBe(false);
  });
});
