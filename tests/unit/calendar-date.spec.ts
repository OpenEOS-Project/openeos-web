import { expect, test } from '@playwright/test';

import { listEventDays } from '@/lib/event-schedule';
import { addDays, daysBetween, isDayKey, listDays, todayKey, toDayKey, toLocalDate } from '@/utils/calendar-date';

import { inTimeZone, TIME_ZONES } from './helpers';

test.describe('calendar-date', () => {
  test('recognises plain calendar days', () => {
    expect(isDayKey('2026-09-12')).toBe(true);
    expect(isDayKey('2026-09-12T00:00:00Z')).toBe(false);
    expect(isDayKey('')).toBe(false);
  });

  for (const timeZone of TIME_ZONES) {
    test(`day arithmetic ignores the time zone (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        expect(daysBetween('2026-09-12', '2026-09-14')).toBe(2);
        expect(listDays('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
        expect(listDays('2026-09-13', '2026-09-12')).toEqual([]);
      });
    });

    test(`a plain day is displayed as that day (${timeZone})`, () => {
      inTimeZone(timeZone, () => {
        const date = toLocalDate('2026-09-12');
        expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 12]);
        expect(toDayKey('2026-09-12')).toBe('2026-09-12');
      });
    });
  }

  test('today is the local day, not the UTC day', () => {
    inTimeZone('Europe/Berlin', () => {
      // 00:30 in Berlin is still the previous day in UTC.
      expect(todayKey(new Date('2026-09-11T22:30:00Z'))).toBe('2026-09-12');
    });
  });

  test('event days keep their old behaviour', () => {
    expect(listEventDays('2026-09-12', '2026-09-14')).toEqual(['2026-09-12', '2026-09-13', '2026-09-14']);
    expect(listEventDays('2026-09-12', '')).toEqual(['2026-09-12']);
    expect(listEventDays('2026-09-12', '2026-09-10')).toEqual(['2026-09-12']);
    expect(listEventDays('', '2026-09-10')).toEqual([]);
  });
});
