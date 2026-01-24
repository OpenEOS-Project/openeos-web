// Enums
export type PaymentMethod = 'cash' | 'card' | 'sumup_terminal' | 'sumup_online';
export type PaymentProvider = 'CASH' | 'CARD' | 'SUMUP';
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
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
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
