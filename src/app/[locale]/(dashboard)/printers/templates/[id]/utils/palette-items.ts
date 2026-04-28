import type { PaletteItem } from '@/types/print-template';

export const PALETTE_ITEMS: PaletteItem[] = [
  // Layout elements
  { type: 'separator', labelKey: 'elements.separator', icon: 'minus', category: 'layout' },
  { type: 'text', labelKey: 'elements.text', icon: 'type01', category: 'layout' },
  { type: 'spacer', labelKey: 'elements.spacer', icon: 'spacing-height', category: 'layout' },
  { type: 'feed', labelKey: 'elements.feed', icon: 'arrow-down', category: 'layout' },
  { type: 'cut', labelKey: 'elements.cut', icon: 'scissors-cut', category: 'layout' },

  // Organization fields
  { type: 'field', field: 'organization_name', labelKey: 'fields.organization_name', icon: 'building', category: 'organization' },
  { type: 'field', field: 'organization_address', labelKey: 'fields.organization_address', icon: 'marker-pin', category: 'organization' },
  { type: 'field', field: 'organization_phone', labelKey: 'fields.organization_phone', icon: 'phone', category: 'organization' },
  { type: 'field', field: 'event_name', labelKey: 'fields.event_name', icon: 'calendar', category: 'organization' },

  // Order fields
  { type: 'field', field: 'order_number', labelKey: 'fields.order_number', icon: 'hash', category: 'order' },
  { type: 'field', field: 'daily_number', labelKey: 'fields.daily_number', icon: 'hash', category: 'order' },
  { type: 'field', field: 'table_number', labelKey: 'fields.table_number', icon: 'layout-grid', category: 'order' },
  { type: 'field', field: 'customer_name', labelKey: 'fields.customer_name', icon: 'user', category: 'order' },
  { type: 'field', field: 'date_time', labelKey: 'fields.date_time', icon: 'clock', category: 'order' },
  { type: 'field', field: 'priority', labelKey: 'fields.priority', icon: 'alert-triangle', category: 'order' },
  { type: 'field', field: 'notes', labelKey: 'fields.notes', icon: 'file-text', category: 'order' },

  // Items
  { type: 'field', field: 'items_list', labelKey: 'fields.items_list', icon: 'list', category: 'items' },

  // Payment fields
  { type: 'field', field: 'subtotal', labelKey: 'fields.subtotal', icon: 'calculator', category: 'payment' },
  { type: 'field', field: 'tax', labelKey: 'fields.tax', icon: 'receipt', category: 'payment' },
  { type: 'field', field: 'total', labelKey: 'fields.total', icon: 'currency-euro', category: 'payment' },
  { type: 'field', field: 'payment_method', labelKey: 'fields.payment_method', icon: 'credit-card', category: 'payment' },
  { type: 'field', field: 'paid_amount', labelKey: 'fields.paid_amount', icon: 'bank-note', category: 'payment' },
  { type: 'field', field: 'change', labelKey: 'fields.change', icon: 'coins', category: 'payment' },

  // Other
  { type: 'field', field: 'qr_code', labelKey: 'fields.qr_code', icon: 'qr-code', category: 'other' },
];

export const PALETTE_CATEGORIES = [
  { key: 'layout', labelKey: 'layoutElements' },
  { key: 'organization', labelKey: 'organizationFields' },
  { key: 'order', labelKey: 'orderFields' },
  { key: 'items', labelKey: 'itemFields' },
  { key: 'payment', labelKey: 'paymentFields' },
  { key: 'other', labelKey: 'otherFields' },
] as const;
