/**
 * Schichtplan-Assistent: aus Zeitraum, Uhrzeiten und Schichtzahl die
 * einzelnen Schichten erzeugen.
 *
 * Alle Tage sind reine Kalendertage ('YYYY-MM-DD', siehe
 * utils/calendar-date). Frueher lief die Schleife ueber Date-Objekte und
 * schnitt den Tag mit toISOString() ab; der aus der Veranstaltung
 * vorbelegte Start (lokale Mitternacht, in UTC der Vorabend) wurde dabei
 * zum Vortag.
 */

import { type DayKey, isDayKey, listDays, toDayKey } from '@/utils/calendar-date';

export interface ShiftDayTimes {
  /** 'HH:mm' */
  start: string;
  /** 'HH:mm' */
  end: string;
}

export interface GeneratedShiftDraft {
  date: DayKey;
  startTime: string;
  endTime: string;
}

export interface ShiftGeneratorInput {
  startDate: DayKey;
  endDate: DayKey;
  /** Uhrzeiten fuer alle Tage ohne eigene Angabe. */
  defaultTimes: ShiftDayTimes;
  /** Abweichende Uhrzeiten je Tag. */
  dayTimes?: Record<DayKey, ShiftDayTimes>;
  shiftsPerDay: number;
  /** Ueberlappung in Minuten; die letzte Schicht des Tages bekommt keine. */
  overlapMinutes?: number;
}

export type ShiftGeneratorResult =
  | { ok: true; shifts: GeneratedShiftDraft[] }
  | { ok: false; reason: 'invalidDates' }
  | { ok: false; reason: 'endBeforeStart'; date: DayKey };

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Minuten in 'HH:mm'; Werte ueber Mitternacht (25:00) werden zu 01:00. */
export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Dauer in Minuten; Ende vor Start heisst "naechster Tag" (22:00–01:00 = 180). */
export function durationMinutes(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return e <= s ? 1440 - s + e : e - s;
}

/**
 * Zeitraum einer Veranstaltung als Kalendertage fuer die Vorbelegung.
 * Die API liefert Zeitpunkte (lokale Mitternacht des Starttags); massgeblich
 * ist der Tag, auf den sie in der Zone des Browsers fallen.
 */
export function eventDayRange(event: {
  startDate?: string | null;
  endDate?: string | null;
} | null | undefined): { startDate: DayKey; endDate: DayKey } | null {
  if (!event?.startDate || !event?.endDate) return null;
  const startDate = toDayKey(event.startDate);
  const endDate = toDayKey(event.endDate);
  if (!isDayKey(startDate) || !isDayKey(endDate)) return null;
  return { startDate, endDate };
}

export function generateShifts(input: ShiftGeneratorInput): ShiftGeneratorResult {
  const days = listDays(input.startDate, input.endDate);
  if (days.length === 0 || input.shiftsPerDay < 1) return { ok: false, reason: 'invalidDates' };

  const overlap = input.overlapMinutes ?? 0;
  const shifts: GeneratedShiftDraft[] = [];

  for (const date of days) {
    const { start, end } = input.dayTimes?.[date] ?? input.defaultTimes;
    const startMins = timeToMinutes(start);
    const total = durationMinutes(start, end);
    if (total <= 0) return { ok: false, reason: 'endBeforeStart', date };

    const shiftDuration = Math.floor(total / input.shiftsPerDay);
    for (let i = 0; i < input.shiftsPerDay; i++) {
      const shiftStart = startMins + i * shiftDuration;
      const isLast = i === input.shiftsPerDay - 1;
      shifts.push({
        date,
        startTime: minutesToTime(shiftStart),
        endTime: minutesToTime(shiftStart + shiftDuration + (isLast ? 0 : overlap)),
      });
    }
  }

  return { ok: true, shifts };
}
