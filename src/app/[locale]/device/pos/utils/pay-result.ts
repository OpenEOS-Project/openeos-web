import type { PaymentMethod } from '@/types/payment';
import type { PaymentsBatchData } from '@/types/table';
import type { PayResult } from '../components/pay-sheet';

/**
 * Zahlart der API zum Ergebnis des Kassieren-Blatts (Geld-Anteil).
 * `free` gibt es dort nicht (keine Zahlung); hier als Bar gezählt wie bisher.
 */
export function paymentMethodOf(result: Pick<PayResult, 'method'>): PaymentMethod {
  switch (result.method) {
    case 'tokens':
      return 'tokens';
    case 'sumup':
      return 'sumup_terminal';
    case 'card':
      return 'card';
    case 'test_cash':
      return 'test_cash';
    case 'test_card':
      return 'test_card';
    default:
      return 'cash';
  }
}

/**
 * Felder einer Sammelzahlung aus dem Ergebnis des Kassieren-Blatts:
 * Zahlart des Geldes, erhaltenes Bargeld, Trinkgeld, SumUp-Transaktion und
 * die Wertmarken. Nur mit Marken bezahlt → Zahlart `tokens`.
 */
export function batchPaymentFields(
  result: PayResult,
): Pick<
  PaymentsBatchData,
  'paymentMethod' | 'amountReceived' | 'tipAmount' | 'providerTransactionId' | 'tokens' | 'tokenExcessAsTip'
> {
  const method = paymentMethodOf(result);
  return {
    paymentMethod: method,
    ...(method === 'cash' && result.amountReceived !== undefined ? { amountReceived: result.amountReceived } : {}),
    ...(result.tip > 0 ? { tipAmount: result.tip } : {}),
    ...(result.method === 'sumup' && result.transactionId ? { providerTransactionId: result.transactionId } : {}),
    ...(result.tokens && result.tokens.length > 0 ? { tokens: result.tokens } : {}),
    ...(result.tokenExcessAsTip ? { tokenExcessAsTip: true } : {}),
  };
}

/**
 * Rückgeld (Bargeld und „Bar (Test)“ — dort nur angezeigt, nie gebucht):
 * erhalten − (Betrag − Marken).
 */
export function cashChangeOf(result: PayResult, due: number): number {
  if (result.amountReceived === undefined) return 0;
  return Math.round((result.amountReceived - Math.max(0, due - (result.tokenValue ?? 0))) * 100) / 100;
}
