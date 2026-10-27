import { toIntlLocale } from '@/utils/format';
import type { EventBilling, EventUnlockCancellationBlock } from '@/types/billing';

/**
 * Die Stornofrist so, wie sie der Kunde lesen soll: mit Wochentag und
 * Uhrzeit, in der Zeitzone der Organisation — nicht in der des Browsers.
 * Wer aus dem Urlaub nachsieht, soll dieselbe Frist sehen wie zu Hause.
 *
 * "Fr., 04.09.2026, 17:00" bzw. "Fri, 04/09/2026, 17:00".
 *
 * Fällt die Frist genau auf Mitternacht (Veranstaltung beginnt um 0:00),
 * steht dort der Vortag, 23:59: "bis Sa., 00:00" lesen viele als "bis
 * Samstagabend". Die Regel bleibt dieselbe — stornieren geht bis vor
 * diesem Zeitpunkt, also bis einschließlich 23:59 am Vortag.
 */
export function formatUnlockDeadline(iso: string, locale: string, timeZone: string): string {
  const deadline = new Date(iso);
  const shown = isLocalMidnight(deadline, timeZone) ? new Date(deadline.getTime() - 60_000) : deadline;
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(shown);
}

/** Ob ein Zeitpunkt in dieser Zeitzone genau auf 00:00:00 fällt. */
function isLocalMidnight(date: Date, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return value('hour') === 0 && value('minute') === 0 && value('second') === 0 && date.getUTCMilliseconds() === 0;
}

/** Was der Freischaltungs-Dialog zeigt — aus den Abrechnungsdaten abgeleitet. */
export type EventUnlockView =
  /** Bezahlt oder auf Rechnung bestellt, Storno möglich. */
  | { kind: 'cancellable'; via: 'stripe' | 'invoice'; deadline: string }
  /** Bezahlt oder auf Rechnung, aber Storno gerade nicht möglich. */
  | {
      kind: 'locked';
      via: 'stripe' | 'invoice';
      reason: EventUnlockCancellationBlock;
      deadline: string | null;
    }
  /** Freigeschaltet, ohne dass etwas berechnet wurde. */
  | { kind: 'waived' }
  /** Nicht (mehr) freigeschaltet. */
  | { kind: 'not_unlocked' };

export function describeEventUnlock(billing: EventBilling): EventUnlockView {
  if (billing.billingStatus === 'waived') return { kind: 'waived' };
  if (billing.billingStatus !== 'paid' && billing.billingStatus !== 'invoice') {
    return { kind: 'not_unlocked' };
  }

  const via = billing.billingStatus === 'paid' ? 'stripe' : 'invoice';
  const { allowed, deadline, blockedReason } = billing.cancellation;
  if (allowed && deadline) return { kind: 'cancellable', via, deadline };
  return { kind: 'locked', via, reason: blockedReason ?? 'deadline_passed', deadline };
}

/**
 * Hinweis für den Bezahldialog: bis wann sich die Freischaltung nach dem
 * Bezahlen kostenlos stornieren ließe. `null`, wenn die API keine Frist
 * kennt (etwa ohne Beginn).
 */
export function checkoutCancellationHint(
  billing: EventBilling,
  now: Date = new Date(),
): { kind: 'until'; deadline: string } | { kind: 'too_late' } | null {
  const deadline = billing.cancellation?.deadline;
  if (!deadline) return null;
  return new Date(deadline).getTime() > now.getTime()
    ? { kind: 'until', deadline }
    : { kind: 'too_late' };
}
