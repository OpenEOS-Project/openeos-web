/**
 * Zeitplan einer Veranstaltung — die Browser-Seite davon.
 *
 * Massgeblich rechnet der Server (`event-schedule.util.ts` in openeos-api);
 * er kennt die Zeitzone der Organisation und liefert die Fenster, nach denen
 * sich der Shop richtet. Hier geht es nur um das Formular: welche Tage der
 * eingetragene Zeitraum umfasst und wie die Oeffnungszeiten darauf liegen.
 *
 * Eine Veranstaltung ist ein Bereich aus Kalendertagen; die Uhrzeiten stehen
 * an den einzelnen Shop-Tagen. Endet ein Tag nicht spaeter, als er beginnt,
 * gehoert sein Ende auf den Folgetag — "10 bis 2 Uhr" ist eine Nacht.
 *
 * Aendert sich die Regel dort, muss sie hier mitgehen.
 */

/** Ein Oeffnungstag, wie ihn das Formular fuehrt. */
export interface ShopDaySetting {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' */
  start: string;
  /** 'HH:mm' */
  end: string;
}

/** Ein Oeffnungstag im Formular, inklusive der geschlossenen. */
export interface ShopDayRow extends ShopDaySetting {
  open: boolean;
}

export const DEFAULT_DAY_START = '10:00';
export const DEFAULT_DAY_END = '22:00';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayNumber(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY;
}

function dayKey(day: number): string {
  const date = new Date(day * MS_PER_DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Die Kalendertage des Zeitraums, der Reihe nach. Beide Enden zaehlen mit. */
export function listEventDays(startDate: string, endDate: string): string[] {
  const first = dayNumber(startDate);
  if (first === null) return [];
  const last = dayNumber(endDate || startDate);
  if (last === null || last < first) return [dayKey(first)];
  return Array.from({ length: last - first + 1 }, (_, offset) => dayKey(first + offset));
}

/** Abgerechnete Veranstaltungstage. */
export function countEventDays(startDate: string, endDate: string): number {
  return Math.max(1, listEventDays(startDate, endDate).length);
}

/**
 * Die Tagesliste an einen geaenderten Zeitraum angleichen.
 *
 * Tage, die schon eingestellt waren, behalten ihre Uhrzeiten — wer den
 * Zeitraum um einen Tag verlaengert, will die uebrigen nicht neu eintragen.
 * Neue Tage uebernehmen die Zeiten des letzten bekannten Tages, weil sich
 * die Oeffnungszeiten eines Festes selten von Tag zu Tag voellig aendern.
 */
export function syncShopDays(
  startDate: string,
  endDate: string,
  existing: ShopDayRow[],
): ShopDayRow[] {
  const known = new Map(existing.map((row) => [row.date, row]));
  const last = existing[existing.length - 1];
  const fallbackStart = last?.start || DEFAULT_DAY_START;
  const fallbackEnd = last?.end || DEFAULT_DAY_END;

  return listEventDays(startDate, endDate).map((date) => {
    const row = known.get(date);
    if (row) return row;
    return { date, start: fallbackStart, end: fallbackEnd, open: true };
  });
}

/** Nur die geoeffneten Tage — das ist, was gespeichert wird. */
export function toStoredDays(rows: ShopDayRow[]): ShopDaySetting[] {
  return rows
    .filter((row) => row.open)
    .map(({ date, start, end }) => ({ date, start, end }));
}

/** Gespeicherte Tage zurueck ins Formular, geschlossene Tage ergaenzt. */
export function fromStoredDays(
  startDate: string,
  endDate: string,
  stored: ShopDaySetting[] | undefined,
): ShopDayRow[] {
  const known = new Map((stored ?? []).map((day) => [day.date, day]));
  return listEventDays(startDate, endDate).map((date) => {
    const day = known.get(date);
    return day
      ? { ...day, open: true }
      : { date, start: DEFAULT_DAY_START, end: DEFAULT_DAY_END, open: stored ? false : true };
  });
}

function toMinutes(time: string): number {
  const [hour, minute] = (time || '00:00').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

/** Laeuft dieser Tag ueber Mitternacht? */
export function isOvernight(row: ShopDaySetting): boolean {
  return toMinutes(row.end) <= toMinutes(row.start);
}

/** 'YYYY-MM-DD' als Datum fuer die Anzeige. */
export function parseDayKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Zeitraum als lokale Mitternacht — so wird er an die API geschickt. */
export function toIsoAtMidnight(dateKey: string): string {
  return parseDayKey(dateKey).toISOString();
}

/** Der Kalendertag eines ISO-Zeitpunkts, in der Zone des Browsers. */
export function toDayKey(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
