import { parseAmount } from '@/utils/refund-form';
import type { PlatformCancellationPreview } from '@/types/billing';

/** Voller (noch erstattbarer) Betrag oder ein Teilbetrag. */
export type PlatformRefundMode = 'full' | 'partial';

export type PlatformRefundProblem =
  | 'nothing_refundable'
  | 'online_refund_unavailable'
  | 'amount_invalid'
  | 'amount_too_high'
  | 'reason_required';

export interface PlatformRefundPlan {
  /** Zu erstattender Betrag; NaN, solange der Teilbetrag ungültig ist. */
  amount: number;
  /** Was an die API geht: null = alles Erstattbare. */
  payloadAmount: number | null;
  /**
   * Kulanz: mit echten Bestellungen oder bei einem Teilbetrag bleibt die
   * Freischaltung bestehen (so entscheidet auch die API). Sonst ist es ein
   * Storno und eine aktive Veranstaltung wechselt in den Testmodus.
   */
  keepsUnlock: boolean;
  problem: PlatformRefundProblem | null;
}

const cents = (value: number) => Math.round(value * 100);

/**
 * Was der Super-Admin-Dialog „Storno/Erstattung“ mit diesen Eingaben
 * auslösen würde. Spiegelt die Regeln der API, damit Knopf und Hinweis
 * schon vor dem Absenden stimmen; entscheiden tut die API.
 */
export function planPlatformRefund(
  preview: PlatformCancellationPreview,
  input: { mode: PlatformRefundMode; amountText: string; reason: string },
): PlatformRefundPlan {
  const partial = input.mode === 'partial';
  const amount = partial ? parseAmount(input.amountText) : preview.refundable;
  const isPartialAmount = partial && Number.isFinite(amount) && cents(amount) < cents(preview.refundable);
  const keepsUnlock = preview.realOrders > 0 || isPartialAmount;

  let problem: PlatformRefundProblem | null = null;
  if (cents(preview.refundable) <= 0) problem = 'nothing_refundable';
  else if (!preview.onlineRefundAvailable) problem = 'online_refund_unavailable';
  else if (partial && !(Number.isFinite(amount) && cents(amount) > 0)) problem = 'amount_invalid';
  else if (partial && cents(amount) > cents(preview.refundable)) problem = 'amount_too_high';
  else if (!input.reason.trim()) problem = 'reason_required';

  return {
    amount,
    payloadAmount: isPartialAmount ? cents(amount) / 100 : null,
    keepsUnlock,
    problem,
  };
}
