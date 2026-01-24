import type { Product } from './product';
import type { Category } from './category';

// Enums
export type OrderStatus = 'open' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
export type OrderPaymentStatus = 'unpaid' | 'partly_paid' | 'paid' | 'refunded';
export type OrderSource = 'pos' | 'online' | 'qr_order';
export type OrderPriority = 'normal' | 'high' | 'rush';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

// Selected Option for Order Items
export interface SelectedOption {
  group: string;
  option: string;
  priceModifier: number;
}

export interface OrderItemOptions {
  selected: SelectedOption[];
}

// Order Item
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  categoryId: string;
  productName: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  optionsPrice: number;
  taxRate: number;
  totalPrice: number;
  options: OrderItemOptions;
  status: OrderItemStatus;
  notes: string | null;
  kitchenNotes: string | null;
  paidQuantity: number;
  preparedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  category?: Category;
}

// Order
export interface Order {
  id: string;
  organizationId: string;
  eventId: string | null;
  orderNumber: string;
  dailyNumber: number;
  tableNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  source: OrderSource;
  subtotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  tipAmount: number;
  discountAmount: number;
  discountReason: string | null;
  notes: string | null;
  priority: OrderPriority;
  estimatedReadyAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdByUserId: string | null;
  createdByDeviceId: string | null;
  onlineSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

// DTOs for creating/updating orders
export interface CreateOrderItemData {
  productId: string;
  quantity: number;
  notes?: string;
  kitchenNotes?: string;
  selectedOptions?: SelectedOption[];
}

export interface CreateOrderData {
  eventId?: string;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  priority?: OrderPriority;
  source?: OrderSource;
  items?: CreateOrderItemData[];
}

export interface UpdateOrderData {
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  priority?: OrderPriority;
  discountAmount?: number;
  discountReason?: string | null;
}

export interface AddOrderItemData {
  productId: string;
  quantity: number;
  notes?: string;
  kitchenNotes?: string;
  selectedOptions?: SelectedOption[];
}

export interface UpdateOrderItemData {
  quantity?: number;
  notes?: string | null;
  kitchenNotes?: string | null;
}

export interface CancelOrderData {
  reason?: string;
}

export interface QueryOrdersParams {
  eventId?: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  source?: OrderSource;
  tableNumber?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
