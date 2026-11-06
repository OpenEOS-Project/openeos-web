/**
 * Cloud-TSE: reine Hilfen für die Integrationsseite, die Kasse und die
 * Bestellansicht (Vertrag: tse-swissbit-plan.md §8).
 */
import type {
  DeviceTseStatus,
  TseEligibility,
  TseLifecycleOutlook,
  TseMasterDataField,
  TseReceiptView,
  TsePostponement,
  TseStatus,
  TseUnit,
  TseUnitState,
} from '@/types/tse';

/**
 * Schritt der Einrichtung, wie ihn Katalog, Seite und Betriebsart zeigen —
 * immer der Grund, der die TSE gerade aufhält, mit der Aktion dazu:
 * - `unavailable`: dieser Server bietet keine Cloud-TSE an,
 * - `country_missing`: die Organisation hat noch kein Land,
 * - `country`: Organisation nicht in Deutschland,
 * - `paid_event_required`: keine bezahlte (freigeschaltete) Veranstaltung —
 *   zuerst, weil ohne sie auch Einschalten nichts anlegt,
 * - `integration_disabled`: Integration ausgeschaltet,
 * - `master_data`: Steuernummer/USt-IdNr. oder Anschrift fehlen (DSFinV-K),
 * - `too_early`: Veranstaltung beginnt erst in einem späteren Monat,
 * - `failed`: Anlage gescheitert, neuer Versuch möglich,
 * - `ready`: kann jetzt angelegt werden (sonst automatisch am ersten
 *   Veranstaltungstag),
 * - `creating`: wird bei Swissbit angelegt (Seite fragt nach),
 * - `active`: signiert.
 * Eine endgültig deaktivierte TSE ist kein eigener Schritt: danach zählt,
 * was einer neuen im Weg steht.
 */
export type TseSetupStep =
  | 'unavailable'
  | 'country_missing'
  | 'country'
  | 'master_data'
  | 'paid_event_required'
  | 'integration_disabled'
  | 'master_data'
  | 'too_early'
  | 'failed'
  | 'ready'
  | 'creating'
  | 'active';

/**
 * Bezahlte Veranstaltung und Monat: `event` = früheste freigeschaltete
 * Veranstaltung, die noch nicht vorbei ist (`null` = keine);
 * `availableFrom` = erster Tag ihres Monats, solange der noch bevorsteht.
 */
export interface TseEventCheck {
  event: { id: string; name: string; startDate: string } | null;
  availableFrom: string | null;
}

/** Was der Schritt braucht — aus GET …/tse, ergänzt um die Veranstaltungsliste. */
export interface TseSetupInput {
  available: boolean;
  integrationEnabled: boolean;
  country: string | null | undefined;
  /** `undefined`, solange sich Veranstaltung und Monat nicht sagen lassen. */
  events: TseEventCheck | undefined;
  /** Fehlende DSFinV-K-Stammdaten (leer = vollständig). */
  masterDataMissing: TseMasterDataField[];
  unitState: TseUnitState | null | undefined;
}

/**
 * Veranstaltung und Monat aus der Antwort von GET …/tse — die API prüft sie
 * aber nur bei eingeschalteter Integration in Deutschland. Sonst `undefined`.
 */
export function tseEventCheckFromEligibility(eligibility: TseEligibility | null | undefined): TseEventCheck | undefined {
  if (!eligibility) return undefined;
  if (eligibility.ok || eligibility.reason === 'TSE_TOO_EARLY') {
    return { event: eligibility.event, availableFrom: eligibility.reason === 'TSE_TOO_EARLY' ? eligibility.availableFrom : null };
  }
  if (eligibility.reason === 'TSE_REQUIRES_PAID_EVENT') return { event: null, availableFrom: null };
  return undefined;
}

const ALL_MASTER_DATA: TseMasterDataField[] = ['taxNumber', 'street', 'zip', 'city'];

/**
 * Fehlende Stammdaten laut GET …/tse: die Liste bei
 * `TSE_MASTER_DATA_REQUIRED`, leer, wenn die API schon weiter war
 * (Veranstaltung/Monat/ok), sonst `undefined` (nicht geprüft).
 */
export function tseMasterDataMissingFromEligibility(
  eligibility: TseEligibility | null | undefined,
): TseMasterDataField[] | undefined {
  if (!eligibility) return undefined;
  if (eligibility.reason === 'TSE_MASTER_DATA_REQUIRED') {
    return eligibility.missing && eligibility.missing.length > 0 ? eligibility.missing : ALL_MASTER_DATA;
  }
  return tseEventCheckFromEligibility(eligibility) ? [] : undefined;
}

/** Freigeschaltet wie in der API (EVENT_UNLOCKED_BILLING_STATUSES). */
const UNLOCKED_BILLING_STATUSES = new Set(['paid', 'invoice', 'waived']);
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in Berlin — die API rechnet den Monat dort. */
function berlinDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

interface TseEventLike {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  billingStatus?: string | null;
}

function upcoming(events: ReadonlyArray<TseEventLike>, now: Date) {
  return events
    .filter((e): e is TseEventLike & { startDate: string } => !!e.startDate)
    .filter((e) => {
      const end = e.endDate ? new Date(e.endDate).getTime() : new Date(e.startDate).getTime() + DAY_MS;
      return end > now.getTime();
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

/**
 * Dieselbe Prüfung wie TseUnitService.qualifyingEvents/eligibility in der
 * API, aus der Veranstaltungsliste — für den Fall, dass die API sie nicht
 * gemacht hat (Integration aus, kein Land). Auf einer eigenen Installation
 * zählt jede Veranstaltung (keine Abrechnung).
 */
export function tseEventCheckFromEvents(
  events: ReadonlyArray<TseEventLike>,
  options: { selfHosted: boolean; now?: Date },
): TseEventCheck {
  const now = options.now ?? new Date();
  const first = upcoming(events, now).find(
    (e) => options.selfHosted || UNLOCKED_BILLING_STATUSES.has(e.billingStatus ?? 'none'),
  );
  if (!first) return { event: null, availableFrom: null };
  const monthStart = `${berlinDate(new Date(first.startDate)).slice(0, 7)}-01`;
  return {
    event: { id: first.id, name: first.name, startDate: first.startDate },
    availableFrom: berlinDate(now) < monthStart ? monthStart : null,
  };
}

/** Nächste Veranstaltung, die sich noch freischalten lässt — Ziel des Knopfs „freischalten“. */
export function tseUnlockCandidate<T extends TseEventLike>(
  events: ReadonlyArray<T>,
  now = new Date(),
): T | null {
  return (
    (upcoming(events, now) as T[]).find((e) => !UNLOCKED_BILLING_STATUSES.has(e.billingStatus ?? 'none')) ?? null
  );
}

/**
 * Grund, der die TSE gerade aufhält. `null`, wenn er sich noch nicht sagen
 * lässt (Veranstaltungen nicht geladen, Integration an).
 */
export function tseSetupStepFrom(input: TseSetupInput): TseSetupStep | null {
  if (input.unitState === 'active') return 'active';
  if (input.unitState === 'creating') return 'creating';
  if (!input.available) return 'unavailable';
  const country = (input.country ?? '').trim().toUpperCase();
  if (!country) return 'country_missing';
  if (country !== 'DE') return 'country';
  if (input.events && !input.events.event) return 'paid_event_required';
  if (!input.integrationEnabled) return 'integration_disabled';
  if (input.masterDataMissing.length > 0) return 'master_data';
  if (!input.events) return null;
  if (input.events.availableFrom) return 'too_early';
  if (input.unitState === 'failed') return 'failed';
  return 'ready';
}

/** Schritt aus GET …/tse allein (Seite /integrations/tse ohne Veranstaltungsliste). */
export function tseSetupStep(status: TseStatus | null | undefined): TseSetupStep {
  if (!status) return 'unavailable';
  return (
    tseSetupStepFrom({
      available: status.available,
      integrationEnabled: status.integrationEnabled,
      country: status.country,
      events: tseEventCheckFromEligibility(status.eligibility),
      masterDataMissing: tseMasterDataMissingFromEligibility(status.eligibility) ?? [],
      unitState: status.unit?.state,
    }) ?? 'ready'
  );
}

/** Was der Hinweis zum Schritt anbietet. */
export type TseHintAction = 'set_country' | 'enable' | 'master_data' | 'unlock_event' | 'setup' | 'retry' | null;

export interface TseHint {
  /** Schlüssel unter `integrations.tse.hint` (mit `.title`, `.text`, ggf. `.short`/`.action`). */
  key: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  action: TseHintAction;
}

/** Grund → Hinweis mit direkter Aktion (Katalogkarte, Infofenster, Seite, Betriebsart). */
export function tseHint(step: TseSetupStep): TseHint {
  switch (step) {
    case 'unavailable':
      return { key: 'unavailable', tone: 'info', action: null };
    case 'country_missing':
      return { key: 'countryMissing', tone: 'warn', action: 'set_country' };
    case 'country':
      return { key: 'countryUnsupported', tone: 'info', action: null };
    case 'paid_event_required':
      return { key: 'paidEventRequired', tone: 'warn', action: 'unlock_event' };
    case 'integration_disabled':
      return { key: 'integrationDisabled', tone: 'info', action: 'enable' };
    case 'master_data':
      return { key: 'masterData', tone: 'warn', action: 'master_data' };
    case 'too_early':
      return { key: 'tooEarly', tone: 'info', action: null };
    case 'failed':
      return { key: 'failed', tone: 'danger', action: 'retry' };
    case 'ready':
      return { key: 'ready', tone: 'ok', action: 'setup' };
    case 'creating':
      return { key: 'creating', tone: 'info', action: null };
    case 'active':
      return { key: 'active', tone: 'ok', action: null };
  }
}

export type TseRequirementId = 'server' | 'country' | 'masterData' | 'paidEvent' | 'integration' | 'setup';

/**
 * Checkliste der Voraussetzungen (✓ erfüllt, • offen); `current` ist die,
 * an der der Hinweis gerade hängt. Den Server zeigt sie nur, wenn er
 * fehlt — sonst wäre er für jeden ein Haken ohne Aussage. `setup` heißt:
 * TSE angelegt (der Monat der Veranstaltung steht in ihrer Beschriftung).
 */
export interface TseRequirement {
  id: TseRequirementId;
  ok: boolean;
  current: boolean;
}

const STEP_REQUIREMENT: Record<TseSetupStep, TseRequirementId | null> = {
  unavailable: 'server',
  country_missing: 'country',
  country: 'country',
  paid_event_required: 'paidEvent',
  integration_disabled: 'integration',
  master_data: 'masterData',
  too_early: 'setup',
  failed: 'setup',
  ready: 'setup',
  creating: 'setup',
  active: null,
};

export function tseRequirements(input: TseSetupInput, step: TseSetupStep): TseRequirement[] {
  const country = (input.country ?? '').trim().toUpperCase();
  const current = STEP_REQUIREMENT[step];
  const items: Array<{ id: TseRequirementId; ok: boolean }> = [
    { id: 'server', ok: input.available },
    { id: 'country', ok: country === 'DE' },
    { id: 'masterData', ok: input.masterDataMissing.length === 0 },
    { id: 'paidEvent', ok: !!input.events?.event },
    { id: 'integration', ok: input.integrationEnabled },
    { id: 'setup', ok: input.unitState === 'active' },
  ];
  return items
    .filter((item) => item.id !== 'server' || !item.ok)
    .map((item) => ({ ...item, current: item.id === current }));
}

/** „2d38954f…162a“ — Kurzform für Tabellen; vollständig im Tooltip/Kopierknopf. */
export function shortSerial(serial: string | null | undefined, head = 8, tail = 4): string {
  if (!serial) return '–';
  if (serial.length <= head + tail + 1) return serial;
  return `${serial.slice(0, head)}…${serial.slice(-tail)}`;
}

/** Bytes lesbar (1024er-Stufen, wie die TSE ihren Speicher angibt). */
export function formatBytes(bytes: number | null | undefined, locale: string): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '–';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${units[unit]}`;
}

/** Anteil 0–100 (gerundet), `null` ohne Werte. */
export function percentOf(used: number | null | undefined, max: number | null | undefined): number | null {
  if (!used && used !== 0) return null;
  if (!max) return null;
  return Math.min(100, Math.max(0, Math.round((used / max) * 100)));
}

/**
 * Vorgänge, die als Beleg zählen (Kassenbeleg, Gegenbeleg, Pfand, Kassenbuch) — nicht
 * der Bestellvorgang (`Bestellung-V1`) und kein Abbruch.
 */
export function isReceiptTse(view: TseReceiptView): boolean {
  return (
    view.kind === 'receipt' ||
    view.kind === 'refund' ||
    view.kind === 'deposit_return' ||
    view.kind === 'cashbook'
  );
}

/** Belege aus den TSE-Vorgängen einer Antwort, ohne Doppelte. */
export function receiptTseViews(views: ReadonlyArray<TseReceiptView | null | undefined>): TseReceiptView[] {
  const seen = new Set<string>();
  const out: TseReceiptView[] = [];
  for (const view of views) {
    if (!view || !isReceiptTse(view) || seen.has(view.id)) continue;
    seen.add(view.id);
    out.push(view);
  }
  return out;
}

/** Vermerk auf dem Beleg: Ausfall, Training oder keiner. */
export function tseNoticeKind(view: Pick<TseReceiptView, 'status' | 'training'>): 'failed' | 'training' | null {
  if (view.status === 'failed' || view.status === 'pending') return 'failed';
  if (view.training || view.status === 'training') return 'training';
  return null;
}

/**
 * Ausfall-Hinweis an der Kasse: an, sobald ein Vorgang ohne Signatur
 * blieb; aus, sobald wieder einer signiert wurde. Der letzte Vorgang zählt.
 */
export function outageFromViews(
  previous: boolean,
  views: ReadonlyArray<TseReceiptView | null | undefined>,
): boolean {
  const relevant = views.filter((v): v is TseReceiptView => !!v);
  if (relevant.length === 0) return previous;
  const last = relevant[relevant.length - 1];
  return tseNoticeKind(last) === 'failed';
}

/**
 * Prüft den QR-Inhalt grob gegen DSFinV-K Anhang I (V0, 12 Felder). Die
 * Kasse zeigt den Code nur, wenn er plausibel ist.
 */
export function isV0QrPayload(payload: string | null | undefined): payload is string {
  if (!payload || !payload.startsWith('V0;')) return false;
  return payload.split(';').length >= 12;
}

/**
 * Betrag eines Kassenbelegs aus `processData` (`Beleg^…^11.90:Bar_2.00:Unbar`,
 * auch `AVTraining^…`): Summe der Zahlungen. `null` für Bestellvorgänge
 * und Abbrüche ohne Zahlungen.
 */
export function processDataTotal(processType: string, processData: string | null | undefined): number | null {
  if (processType !== 'Kassenbeleg-V1' || !processData) return null;
  const parts = processData.split('^');
  if (parts.length < 3 || !parts[2]) return null;
  let total = 0;
  for (const payment of parts[2].split('_')) {
    const amount = Number(payment.split(':')[0]);
    if (!Number.isFinite(amount)) return null;
    total += amount;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Zustand der TSE-Pille im Kopf der Kasse: `null` ohne Integration (keine
 * Pille), sonst der Server-Zustand — ein eigener Ausfall (letzter Vorgang
 * ohne Signatur) zählt als `error`, auch bevor der Server ihn meldet.
 */
export function posTseState(
  tse: Pick<DeviceTseStatus, 'state'> | null | undefined,
  outage: boolean,
): DeviceTseStatus['state'] | null {
  if (!tse) return null;
  return outage ? 'error' : tse.state;
}

// ── Lebenszyklus „monthly“ (Abmeldung zum Monatsende) ─────────────────

/** Abmeldung durch den Monatslauf (auch der frühere Name `per_event_cycle`). */
export function isMonthlyDeactivation(reason: string | null | undefined): boolean {
  return reason === 'monthly_cycle' || reason === 'per_event_cycle';
}

/**
 * Die Verschiebung, die zum aktuellen Termin geführt hat (bezahlte
 * Veranstaltung lief zum Monatsende), sonst `null`.
 */
export function currentPostponement(
  unit: Pick<TseUnit, 'plannedDeactivationAt' | 'postponements'> | null | undefined
): TsePostponement | null {
  const planned = unit?.plannedDeactivationAt;
  const list = unit?.postponements ?? [];
  if (!planned || list.length === 0) return null;
  const last = list[list.length - 1];
  return new Date(last.to).getTime() === new Date(planned).getTime() ? last : null;
}

/** Super-Admin-Liste: TSEs, deren Abmeldung zum Monatsende überfällig ist. */
export function overdueUnits<T extends { deactivationOverdue: boolean }>(units: readonly T[]): T[] {
  return units.filter((unit) => unit.deactivationOverdue);
}

// ── Folgemonat schon gebucht (Entscheidung 2026-11-06) ──────────────────

const BERLIN = 'Europe/Berlin';

/** „Dezember“, mit Jahr („Januar 2027“), wenn es nicht das Jahr von `now` ist. */
export function tseMonthLabel(month: string, locale: string, now = new Date()): string {
  const [year, m] = month.split('-').map(Number);
  // Mitte des Monats: kein Zeitzonen-Randproblem.
  const date = new Date(Date.UTC(year, m - 1, 15, 12));
  const currentYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN, year: 'numeric' }).format(now));
  return new Intl.DateTimeFormat(locale, {
    timeZone: BERLIN,
    month: 'long',
    ...(year !== currentYear ? { year: 'numeric' } : {}),
  }).format(date);
}

/** Termin der Abmeldung lang, in Berliner Zeit: `{ date: '31. Dezember 2026', time: '20:00' }`. */
export function tseDeactivationParts(iso: string, locale: string): { date: string; time: string } {
  const at = new Date(iso);
  return {
    date: new Intl.DateTimeFormat(locale, { timeZone: BERLIN, day: 'numeric', month: 'long', year: 'numeric' }).format(at),
    time: new Intl.DateTimeFormat(locale, { timeZone: BERLIN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at),
  };
}

/** Veranstaltungsnamen für den Satz: „A“, „B“ und „C“ (bzw. and). */
export function quotedEventNames(names: readonly string[], locale: string): string {
  const quoted = names.map((name) => (locale.startsWith('de') ? `„${name}“` : `“${name}”`));
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(quoted);
}

export interface TseKeepLine {
  month: string;
  reason: TseLifecycleOutlook['months'][number]['reason'];
  decided: boolean;
  events: string[];
}

/**
 * Sätze „Bleibt im Dezember aktiv, weil …“ aus der Prognose, je Monat einer
 * (Namen ohne Doppelte). Leer ohne Prognose.
 */
export function tseKeepLines(outlook: TseLifecycleOutlook | null | undefined): TseKeepLine[] {
  if (!outlook) return [];
  return outlook.months.map((m) => ({
    month: m.month,
    reason: m.reason,
    decided: m.decided,
    events: [...new Set(m.events.map((e) => e.name))],
  }));
}
