import type { PaymentMethod } from '@/types/payment';
import type { PaymentsBatchData } from '@/types/table';
import type { PayResult } from '../components/pay-sheet';

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
  const method: PaymentMethod =
    result.method === 'tokens'
      ? 'tokens'
      : result.method === 'sumup'
        ? 'sumup_terminal'
        : result.method === 'card'
          ? 'card'
          : 'cash';
  return {
    paymentMethod: method,
    ...(method === 'cash' && result.amountReceived !== undefined ? { amountReceived: result.amountReceived } : {}),
    ...(result.tip > 0 ? { tipAmount: result.tip } : {}),
    ...(result.method === 'sumup' && result.transactionId ? { providerTransactionId: result.transactionId } : {}),
    ...(result.tokens && result.tokens.length > 0 ? { tokens: result.tokens } : {}),
    ...(result.tokenExcessAsTip ? { tokenExcessAsTip: true } : {}),
  };
}

/** Rückgeld (nur Bargeld): erhalten − (Betrag − Marken). */
export function cashChangeOf(result: PayResult, due: number): number {
  if (result.amountReceived === undefined) return 0;
  return Math.round((result.amountReceived - Math.max(0, due - (result.tokenValue ?? 0))) * 100) / 100;
}
