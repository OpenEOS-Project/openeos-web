import { expect, test } from '@playwright/test';

import { currentEventPhase, phaseMoment } from '@/lib/event-phase';

/** Fest 16.–17.11.2026: echt ab 15.11. 18:00 bis 18.11. 12:00 (Berlin). */
const planned = {
  status: 'active' as const,
  phase: 'planned' as const,
  realSalesFrom: '2026-11-15T17:00:00.000Z',
  realSalesUntil: '2026-11-18T11:00:00.000Z',
};
const at = (iso: string) => Date.parse(iso);

test.describe('currentEventPhase', () => {
  test('schreibt die Phase des Servers an den Grenzen fort', () => {
    expect(currentEventPhase(planned, at('2026-11-15T16:59:59Z'))).toBe('planned');
    expect(currentEventPhase(planned, at('2026-11-15T17:00:00Z'))).toBe('active');
    expect(currentEventPhase(planned, at('2026-11-18T10:59:59Z'))).toBe('active');
    expect(currentEventPhase(planned, at('2026-11-18T11:00:00Z'))).toBe('ended');
  });

  test('Testmodus und inaktiv bleiben, wie sie sind', () => {
    expect(currentEventPhase({ ...planned, status: 'test', phase: 'test' }, at('2026-11-16T12:00:00Z'))).toBe('test');
    expect(currentEventPhase({ ...planned, status: 'inactive', phase: 'inactive' }, at('2026-11-16T12:00:00Z'))).toBe(
      'inactive',
    );
  });

  test('ältere API ohne Phase: der Status gilt', () => {
    expect(currentEventPhase({ status: 'active' })).toBe('active');
    expect(currentEventPhase({ status: 'test' })).toBe('test');
    expect(currentEventPhase(null)).toBeNull();
  });

  test('ohne Verkaufsfenster (Bestand ohne Freischaltung): aktiv bleibt aktiv', () => {
    expect(
      currentEventPhase({ status: 'active', phase: 'active', realSalesFrom: null, realSalesUntil: null }, at('2030-01-01T00:00:00Z')),
    ).toBe('active');
  });
});

test.describe('phaseMoment', () => {
  test('Datum und Uhrzeit für den Hinweis', () => {
    process.env.TZ = 'Europe/Berlin';
    expect(phaseMoment('2026-11-15T17:00:00.000Z', 'de-DE')).toEqual({ date: '15.11.', time: '18:00' });
  });
});
