/**
 * Zeitplan einer Veranstaltung — die Browser-Seite davon.
 *
 * Massgeblich rechnet der Server (`event-schedule.util.ts` in openeos-api);
 * er kennt die Zeitzone der Organisation und liefert die Fenster, nach denen
 * sich der Shop richtet. Hier geht es nur um das Formular: welchen Zeitraum
 * die eingegebenen Felder ergeben, wie viele Tage das sind und wie die
 * Oeffnungszeiten daraus aussehen werden. Gerechnet wird in der Zeitzone des
 * Browsers — beim Anlegen einer Veranstaltung sitzt der Mensch praktisch
 * immer in derselben Zone wie die Veranstaltung.
 *
 * Aendert sich die Regel dort, muss sie hier mitgehen. Beide Seiten kennen
 * denselben Begriff des Veranstaltungstags: er beginnt um 06:00, damit eine
 * Nacht nicht in zwei Tage zerfaellt.
 */

const EVENT_DAY_START_HOUR = 6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ShopWindowPreview {
  start: Date;
  end: Date;
}

export interface EventDateFields {
  /** 'YYYY-MM-DD' */
  startDate: string;
  /** 'HH:mm' */
  startTime: string;
  /** 'YYYY-MM-DD' — letzter Veranstaltungstag, nur bei mehrtaegigen. */
  endDate: string;
  /** 'HH:mm' */
  endTime: string;
  multiDay: boolean;
}

function parseDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  const [hour, minute] = (time || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
}

function toMinutes(time: string): number {
  const [hour, minute] = (time || '00:00').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

/**
 * Aus den Formularfeldern den tatsaechlichen Zeitraum bilden.
 *
 * Der eine Kniff: liegt die Endzeit nicht nach der Startzeit, ist das Ende am
 * Folgetag gemeint. "18:00 bis 03:00" ist eine Nacht, kein Datumsfehler —
 * deshalb muss das Enddatum in dem Fall einen Tag weiterspringen, sonst
 * laege das Ende vor dem Beginn.
 */
export function composeEventRange(fields: EventDateFields): { start: Date; end: Date } | null {
  const start = parseDateTime(fields.startDate, fields.startTime);
  if (!start) return null;

  const lastDay = fields.multiDay && fields.endDate ? fields.endDate : fields.startDate;
  const end = parseDateTime(lastDay, fields.endTime);
  if (!end) return null;

  if (toMinutes(fields.endTime) <= toMinutes(fields.startTime)) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

/** Die Formularfelder zu einem bestehenden Zeitraum zurueckgewinnen. */
export function splitEventRange(
  startIso: string | null,
  endIso: string | null,
): EventDateFields {
  const pad = (n: number) => String(n).padStart(2, '0');
  const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const asTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const empty: EventDateFields = {
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    multiDay: false,
  };
  if (!startIso) return empty;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return empty;
  const end = endIso ? new Date(endIso) : start;
  const effectiveEnd = Number.isNaN(end.getTime()) ? start : end;

  // Ein Ende, das ueber Mitternacht gerutscht ist, gehoert im Formular
  // wieder auf den Tag, an dem der Abend begonnen hat.
  const overnight = asTime(effectiveEnd) <= asTime(start);
  const lastDay = new Date(effectiveEnd);
  if (overnight) lastDay.setDate(lastDay.getDate() - 1);

  return {
    startDate: asDate(start),
    startTime: asTime(start),
    endDate: asDate(lastDay),
    endTime: asTime(effectiveEnd),
    multiDay: asDate(lastDay) !== asDate(start),
  };
}

function eventDayNumber(date: Date): number {
  const shifted = new Date(date);
  if (shifted.getHours() < EVENT_DAY_START_HOUR) shifted.setDate(shifted.getDate() - 1);
  return Math.floor(
    Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) / MS_PER_DAY,
  );
}

/** Abgerechnete Veranstaltungstage, immer mindestens einer. */
export function countEventDays(start: Date, end: Date): number {
  const first = eventDayNumber(start);
  const last = eventDayNumber(end);
  if (last <= first) return 1;
  return last - first + 1;
}

/**
 * Die Oeffnungszeiten, die sich aus dem Zeitraum ergeben: je
 * Veranstaltungstag ein Fenster mit denselben Uhrzeiten.
 */
export function deriveShopWindows(start: Date, end: Date): ShopWindowPreview[] {
  const days = countEventDays(start, end);
  const overnight =
    end.getHours() * 60 + end.getMinutes() <= start.getHours() * 60 + start.getMinutes();

  const windows: ShopWindowPreview[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const open = new Date(start);
    open.setDate(open.getDate() + offset);
    const close = new Date(start);
    close.setDate(close.getDate() + offset + (overnight ? 1 : 0));
    close.setHours(end.getHours(), end.getMinutes(), 0, 0);
    windows.push({ start: open, end: close });
  }
  return windows;
}
