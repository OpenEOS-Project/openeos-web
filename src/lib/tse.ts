/**
 * Cloud-TSE: reine Hilfen für die Integrationsseite, die Kasse und die
 * Bestellansicht (Vertrag: tse-swissbit-plan.md §8).
 */
import type { DeviceTseStatus, TseReceiptView, TseStatus } from '@/types/tse';

/**
 * Schritt der Einrichtung, wie ihn die Seite zeigt:
 * - `unavailable`: dieser Server bietet keine Cloud-TSE an,
 * - `country`: Organisation nicht in Deutschland,
 * - `paid_event_required` / `too_early`: Voraussetzungen fehlen noch,
 * - `ready`: kann jetzt angelegt werden (sonst automatisch am ersten
 *   Veranstaltungstag),
 * - `creating`: wird bei Swissbit angelegt (Seite fragt nach),
 * - `active`: signiert,
 * - `failed`: Anlage gescheitert (neuer Versuch möglich, wenn die
 *   Voraussetzungen stimmen),
 * - `deactivated`: endgültig außer Betrieb.
 */
export type TseSetupStep =
  | 'unavailable'
  | 'country'
  | 'paid_event_required'
  | 'too_early'
  | 'ready'
  | 'creating'
  | 'active'
  | 'failed'
  | 'deactivated';

export function tseSetupStep(status: TseStatus | null | undefined): TseSetupStep {
  if (!status) return 'unavailable';
  const unit = status.unit;
  if (unit?.state === 'active') return 'active';
  if (unit?.state === 'creating') return 'creating';
  if (!status.available) return 'unavailable';
  if ((status.country ?? '').toUpperCase() !== 'DE') return 'country';
  if (unit?.state === 'failed') return 'failed';
  if (unit?.state === 'deactivated' && !status.eligibility.ok) return 'deactivated';
  switch (status.eligibility.reason) {
    case 'TSE_REQUIRES_PAID_EVENT':
      return 'paid_event_required';
    case 'TSE_TOO_EARLY':
      return 'too_early';
    case 'TSE_NOT_AVAILABLE':
      return 'unavailable';
    case 'TSE_COUNTRY_NOT_SUPPORTED':
      return 'country';
    default:
      return 'ready';
  }
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
 * Vorgänge, die als Beleg zählen (Kassenbeleg, Gegenbeleg, Pfand) — nicht
 * der Bestellvorgang (`Bestellung-V1`) und kein Abbruch.
 */
export function isReceiptTse(view: TseReceiptView): boolean {
  return view.kind === 'receipt' || view.kind === 'refund' || view.kind === 'deposit_return';
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
