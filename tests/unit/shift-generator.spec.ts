import { expect, test } from '@playwright/test';

import { toIsoAtMidnight } from '@/lib/event-schedule';
import { eventDayRange, generateShifts } from '@/lib/shift-generator';

import { inTimeZone, TIME_ZONES } from './helpers';

/**
 * Der Schichtplan-Assistent belegte den Zeitraum mit dem Vortag vor:
 * Eine Veranstaltung am 12.09.2026 wird als lokale Mitternacht gespeichert
 * (in Berlin 2026-09-11T22:00:00Z), und der Assistent nahm davon den
 * UTC-Tag.
 */
test.describe('shift wizard: event dates', () => {
  test('reproduces the old off-by-one in Berlin', () => {
    inTimeZone('Europe/Berlin', () => {
      const stored = toIsoAtMidnight('2026-09-12');
      expect(stored).toBe('2026-09-11T22:00:00.000Z');
      // The removed implementation:
      expect(new Date(stored).toISOString().split('T')[0]).toBe('2026-09-11');
    });
  });

  test('event stored from Berlin pre-fills 12.09.2026 in Berlin', () => {
    inTimeZone('Europe/Berlin', () => {
      expect(
        eventDayRange({ startDate: '2026-09-11T22:00:00.000Z', endDate: '2026-09-12T22:00:00.000Z' }),
      ).toEqual({ startDate: '2026-09-12', endDate: '2026-09-13' });
    });
  });

  test('event stored as UTC midnight pre-fills 12.09.2026 in UTC', () => {
    inTimeZone('UTC', () => {
      expect(
        eventDayRange({ startDate: '2026-09-12T00:00:00.000Z', endDate: '2026-09-12T00:00:00.000Z' }),
      ).toEqual({ startDate: '2026-09-12', endDate: '2026-09-12' });
    });
  });

  for (const timeZone of TIME_ZONES) {
    test(`event form round trip keeps the calendar day (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        const event = { startDate: toIsoAtMidnight('2026-09-12'), endDate: toIsoAtMidnight('2026-09-13') };
        expect(eventDayRange(event)).toEqual({ startDate: '2026-09-12', endDate: '2026-09-13' });
      });
    });

    test(`generates shifts on the chosen days (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        const result = generateShifts({
          startDate: '2026-09-12',
          endDate: '2026-09-13',
          defaultTimes: { start: '10:00', end: '22:00' },
          shiftsPerDay: 3,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.shifts.map((s) => s.date)).toEqual([
          '2026-09-12',
          '2026-09-12',
          '2026-09-12',
          '2026-09-13',
          '2026-09-13',
          '2026-09-13',
        ]);
        expect(result.shifts.slice(0, 3).map((s) => `${s.startTime}-${s.endTime}`)).toEqual([
          '10:00-14:00',
          '14:00-18:00',
          '18:00-22:00',
        ]);
      });
    });

    test(`crosses the end of daylight saving time without skipping a day (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        const result = generateShifts({
          startDate: '2026-10-24',
          endDate: '2026-10-26',
          defaultTimes: { start: '18:00', end: '02:00' },
          shiftsPerDay: 1,
        });
        expect(result.ok && result.shifts.map((s) => `${s.date} ${s.startTime}-${s.endTime}`)).toEqual([
          '2026-10-24 18:00-02:00',
          '2026-10-25 18:00-02:00',
          '2026-10-26 18:00-02:00',
        ]);
      });
    });
  }
});

test.describe('shift wizard: generator rules', () => {
  test('per-day overrides and overlap', () => {
    const result = generateShifts({
      startDate: '2026-09-12',
      endDate: '2026-09-13',
      defaultTimes: { start: '10:00', end: '18:00' },
      dayTimes: { '2026-09-12': { start: '14:00', end: '01:00' } },
      shiftsPerDay: 2,
      overlapMinutes: 15,
    });
    expect(result.ok && result.shifts).toEqual([
      { date: '2026-09-12', startTime: '14:00', endTime: '19:45' },
      { date: '2026-09-12', startTime: '19:30', endTime: '01:00' },
      { date: '2026-09-13', startTime: '10:00', endTime: '14:15' },
      { date: '2026-09-13', startTime: '14:00', endTime: '18:00' },
    ]);
  });

  test('rejects an end before the start and empty input', () => {
    expect(
      generateShifts({
        startDate: '2026-09-13',
        endDate: '2026-09-12',
        defaultTimes: { start: '10:00', end: '18:00' },
        shiftsPerDay: 2,
      }),
    ).toEqual({ ok: false, reason: 'invalidDates' });
    expect(
      generateShifts({ startDate: '', endDate: '', defaultTimes: { start: '10:00', end: '18:00' }, shiftsPerDay: 2 }),
    ).toEqual({ ok: false, reason: 'invalidDates' });
  });

  test('no event dates, no pre-fill', () => {
    expect(eventDayRange(undefined)).toBeNull();
    expect(eventDayRange({ startDate: '2026-09-12T00:00:00Z', endDate: null })).toBeNull();
  });
});
