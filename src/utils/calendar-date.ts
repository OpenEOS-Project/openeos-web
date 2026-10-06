/**
 * Reine Kalendertage ('YYYY-MM-DD') ohne Zeitzonenverschiebung.
 *
 * Ein Schichttag, ein Shop-Tag oder der Start einer Veranstaltung im
 * Formular ist ein Kalendertag, kein Zeitpunkt. Zwei Fehlerquellen haben
 * solche Tage bisher verschoben:
 *
 * - `new Date('2026-09-12')` liest den Wert als Mitternacht UTC. Westlich
 *   von Greenwich ist das lokal noch der 11.09.
 * - `date.toISOString().split('T')[0]` liefert den Tag in UTC. Die API
 *   speichert den Beginn einer Veranstaltung als lokale Mitternacht
 *   (in Berlin 2026-09-11T22:00:00Z) — daraus wurde der 11.09.
 *
 * Hier wird deshalb ausschliesslich mit den Ziffern gerechnet; Tage
 * addiert und gezaehlt wird ueber Date.UTC, das keine Sommerzeit kennt.
 */

/** Ein Kalendertag im Format 'YYYY-MM-DD'. */
export type DayKey = string;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** true, wenn der Wert ein reiner Kalendertag ohne Uhrzeit ist. */
export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && DAY_KEY.test(value);
}

/** Fortlaufende Tagesnummer (Tage seit 1970-01-01) oder null bei Unsinn. */
function dayNumber(key: string): number | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms / MS_PER_DAY;
}

function fromDayNumber(day: number): DayKey {
  const date = new Date(day * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Der lokale Kalendertag eines Date-Objekts (Zone des Browsers). */
export function dayKeyOf(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Kalendertag eines Wertes aus der API.
 *
 * Ein reiner Tag bleibt, wie er ist. Ein Zeitpunkt (ISO mit Uhrzeit oder
 * Date) zaehlt zu dem Tag, auf den er in der Zone des Browsers faellt —
 * so, wie ihn auch die Anzeige zeigt.
 */
export function toDayKey(value: string | Date): DayKey {
  if (typeof value === 'string' && isDayKey(value)) return value;
  return dayKeyOf(typeof value === 'string' ? new Date(value) : value);
}

/** Heute als Kalendertag, in der Zone des Browsers. */
export function todayKey(now: Date = new Date()): DayKey {
  return dayKeyOf(now);
}

/** 'YYYY-MM-DD' als lokale Mitternacht — fuer Anzeige und Intl. */
export function parseDayKey(key: DayKey): Date {
  const match = DAY_KEY.exec(key);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Kalendertag plus/minus n Tage. */
export function addDays(key: DayKey, days: number): DayKey {
  const day = dayNumber(key);
  if (day === null) return key;
  return fromDayNumber(day + days);
}

/** Abstand in Tagen (Ende minus Start); null bei ungueltiger Eingabe. */
export function daysBetween(start: DayKey, end: DayKey): number | null {
  const first = dayNumber(start);
  const last = dayNumber(end);
  if (first === null || last === null) return null;
  return last - first;
}

/** Alle Kalendertage von Start bis Ende, beide eingeschlossen. Leer, wenn das Ende vor dem Start liegt. */
export function listDays(start: DayKey, end: DayKey): DayKey[] {
  const first = dayNumber(start);
  const last = dayNumber(end);
  if (first === null || last === null || last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, offset) => fromDayNumber(first + offset));
}

/**
 * Wert aus der API als Date fuer die Anzeige: ein reiner Kalendertag als
 * lokale Mitternacht, alles andere als Zeitpunkt.
 */
export function toLocalDate(value: string | Date): Date {
  if (typeof value !== 'string') return value;
  return isDayKey(value) ? parseDayKey(value) : new Date(value);
}
