// Enums
/**
 * `tokens`: nur mit Wertmarken bezahlt (Betrag 0, Wert in `tokenAmount`).
 * `paypal`: nur frühere Zahlungen – die PayPal-Anbindung ist seit 1.8
 * entfernt, neu gebucht wird PayPal nicht mehr.
 */
export type PaymentMethod = 'cash' | 'card' | 'sumup_terminal' | 'sumup_online' | 'tokens' | 'paypal';
export type PaymentProvider = 'CASH' | 'CARD' | 'SUMUP' | 'TOKENS';
export type PaymentTransactionStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

// Payment Metadata
export interface PaymentMetadata {
  cardLastFour?: string;
  cardBrand?: string;
  receiptUrl?: string;
  [key: string]: unknown;
}

// Payment
export interface Payment {
  id: string;
  /** Nur in Antworten auf neue Zahlungen: Kassenbeleg der Cloud-TSE (null ohne TSE). */
  tse?: import('@/types/tse').TseReceiptView | null;
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  /** Mit Wertmarken beglichen (Euro), nicht in `amount`. */
  tokenAmount?: number | string;
  tokenLines?: import('@/types/token').PaymentTokenLine[];
  providerTransactionId: string | null;
  status: PaymentTransactionStatus;
  metadata: PaymentMetadata;
  processedByUserId: string | null;
  processedByDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

// DTOs
export interface CreatePaymentData {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  /** Nur bei Barzahlung relevant; die API speichert es nur, wenn es mindestens dem Zahlbetrag entspricht. */
  amountReceived?: number;
  providerTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface SplitPaymentItemData {
  orderItemId: string;
  quantity: number;
}

export interface SplitPaymentData {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  items: SplitPaymentItemData[];
  /** Nur bei Barzahlung relevant; die API speichert es nur, wenn es mindestens dem Zahlbetrag entspricht. */
  amountReceived?: number;
  providerTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface QueryPaymentsParams {
  orderId?: string;
  status?: PaymentTransactionStatus;
  paymentMethod?: PaymentMethod;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
