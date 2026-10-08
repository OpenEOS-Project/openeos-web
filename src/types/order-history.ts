import type {
  OrderFulfillmentType,
  OrderItemStatus,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  SelectedOption,
} from './order';
import type { PaymentMethod } from './payment';

/**
 * Bestellverlauf (Kasse und Verwaltung): ein klarer Status je Bestellung,
 * serverseitig berechnet (`displayStatus`), dazu Positionen, Zahlungen,
 * Erstattungen (Gegenbelege) und Verlauf.
 */
export type OrderDisplayStatus =
  | 'in_kitchen'
  | 'ready'
  | 'completed'
  | 'unpaid'
  | 'cancelled'
  | 'partly_refunded'
  | 'refunded';

export const ORDER_DISPLAY_STATUSES: OrderDisplayStatus[] = [
  'in_kitchen',
  'ready',
  'completed',
  'unpaid',
  'cancelled',
  'partly_refunded',
  'refunded',
];

/** Zahlart-Filter des Verlaufs. */
export type HistoryPaymentFilter = 'cash' | 'card' | 'sumup' | 'discount';

export interface OrderHistoryRow {
  id: string;
  orderNumber: string;
  dailyNumber: number;
  createdAt: string;
  tableNumber: string | null;
  fulfillmentType: OrderFulfillmentType;
  source: OrderSource;
  customerName: string | null;
  notes: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  displayStatus: OrderDisplayStatus;
  subtotal: number;
  total: number;
  paidAmount: number;
  refundedAmount: number;
  tipAmount: number;
  discountAmount: number;
  pfandTotal: number;
  isTest: boolean;
  eventId: string | null;
  createdByDeviceId: string | null;
  deviceName: string | null;
  paymentMethods: PaymentMethod[];
  items: {
    id: string;
    productName: string;
    quantity: number;
    status: OrderItemStatus;
    totalPrice: number;
  }[];
}

export type OrderHistoryCounts = Record<OrderDisplayStatus | 'all', number>;

export interface OrderHistoryPage {
  data: OrderHistoryRow[];
  meta: { limit: number; total: number; nextCursor: string | null; counts: OrderHistoryCounts };
}

export interface OrderHistoryParams {
  eventId?: string;
  q?: string;
  displayStatus?: OrderDisplayStatus[];
  paymentMethod?: HistoryPaymentFilter[];
  scope?: 'device' | 'all';
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface OrderDetailItem {
  id: string;
  productId: string;
  productName: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  optionsPrice: number;
  totalPrice: number;
  taxRate: number;
  depositAmount: number;
  isRefill: boolean;
  options: SelectedOption[];
  notes: string | null;
  kitchenNotes: string | null;
  status: OrderItemStatus;
  productionStationId: string | null;
  paidQuantity: number;
  refundedQuantity: number;
  refundableQuantity: number;
  /** Erstattung je Stück ohne Storno (Rabatt anteilig, ohne Pfand). */
  unitRefund: number;
  preparedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailPayment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentProvider: string;
  status: string;
  providerTransactionId: string | null;
  amountReceived: number | null;
  change: number | null;
  tipAmount: number | null;
  batchOrderCount: number | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  refundedAmount: number;
  refundable: number;
  createdAt: string;
  deviceId: string | null;
  deviceName: string | null;
  userName: string | null;
}

export type RefundStatus = 'completed' | 'manual' | 'test';
export type RefundKind = 'cancellation' | 'refund';
export type RefundReasonCode =
  | 'wrong_order'
  | 'quality'
  | 'not_delivered'
  | 'customer_request'
  | 'duplicate'
  | 'price_error'
  | 'other';

export const REFUND_REASON_CODES: RefundReasonCode[] = [
  'wrong_order',
  'quality',
  'not_delivered',
  'customer_request',
  'duplicate',
  'price_error',
  'other',
];

export interface OrderRefund {
  id: string;
  refundNumber: string;
  kind: RefundKind;
  amount: number;
  taxTotal: number;
  pfandAmount: number;
  tipAmount: number;
  taxLines: { rate: number; net: number; tax: number; gross: number }[];
  paymentId: string | null;
  paymentMethod: PaymentMethod;
  status: RefundStatus;
  provider: string;
  providerReference: string | null;
  reasonCode: RefundReasonCode;
  reasonText: string | null;
  deviceId: string | null;
  deviceName: string | null;
  userId: string | null;
  actorName: string | null;
  isTest: boolean;
  createdAt: string;
  items: {
    id: string;
    orderItemId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    amount: number;
    depositAmount: number;
    cancelled: boolean;
  }[];
}

export type OrderEventType =
  | 'items_cancelled'
  | 'order_cancelled'
  | 'refunded'
  | 'refund_failed'
  | 'receipt_reprinted'
  | 'tickets_reprinted'
  | 'refund_receipt_reprinted';

export interface OrderEventEntry {
  id: string;
  type: OrderEventType;
  createdAt: string;
  deviceId: string | null;
  userId: string | null;
  actorName: string | null;
  data: Record<string, unknown>;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  dailyNumber: number;
  createdAt: string;
  tableNumber: string | null;
  fulfillmentType: OrderFulfillmentType;
  source: OrderSource;
  customerName: string | null;
  notes: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  displayStatus: OrderDisplayStatus;
  subtotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  refundedAmount: number;
  /** Noch erstattbar (bezahlt minus erstattet). */
  refundable: number;
  /** Noch offen (Summe minus bezahlt). */
  remaining: number;
  tipAmount: number;
  discountAmount: number;
  discountReason: string | null;
  pfandTotal: number;
  isTest: boolean;
  eventId: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdByDeviceId: string | null;
  deviceName: string | null;
  createdByUserName: string | null;
  items: OrderDetailItem[];
  payments: OrderDetailPayment[];
  refunds: OrderRefund[];
  events: OrderEventEntry[];
}

/** Wer die Aktion an der Kasse auslöst (Berechtigung „Nur mit PIN“). */
export interface DeviceActor {
  pin?: string;
  operatorUserId?: string;
}

export interface CancelItemsData extends DeviceActor {
  items: { orderItemId: string; quantity: number }[];
  reasonCode?: RefundReasonCode;
  reasonText?: string;
  confirmStarted?: boolean;
}

export interface CreateRefundData extends DeviceActor {
  mode: 'items' | 'amount' | 'full';
  items?: { orderItemId: string; quantity: number }[];
  amount?: number;
  cancelItems?: boolean;
  includeDeposit?: boolean;
  paymentId?: string;
  reasonCode: RefundReasonCode;
  reasonText?: string;
  confirmStarted?: boolean;
  manual?: boolean;
  clientRequestId?: string;
}

export interface RefundResult {
  refunds: {
    id: string;
    refundNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: RefundStatus;
    printed: boolean;
  }[];
  order: OrderDetail;
}

/** Einstellung „Stornieren & Erstatten“ einer Kasse. */
export type RefundPermission = 'allowed' | 'pin' | 'disabled';
