// Print Template Types

export type PrintTemplateType = 'receipt' | 'kitchen_ticket' | 'order_ticket';

// Template element types for the designer
export type TemplateElementType =
  | 'separator'
  | 'text'
  | 'spacer'
  | 'feed'
  | 'cut'
  | 'field';

// Available data fields
export type TemplateFieldType =
  | 'organization_name'
  | 'organization_address'
  | 'organization_phone'
  | 'event_name'
  | 'order_number'
  | 'daily_number'
  | 'table_number'
  | 'customer_name'
  | 'date_time'
  | 'items_list'
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'payment_method'
  | 'paid_amount'
  | 'change'
  | 'qr_code'
  | 'priority'
  | 'notes';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TemplateElement {
  id: string;
  type: TemplateElementType;
  // Common properties
  align?: TextAlign;
  bold?: boolean;
  big?: boolean;
  // Text element
  content?: string;
  // Field element
  field?: TemplateFieldType;
  label?: string; // Label prefix for field (e.g. "Tisch: ")
  // Separator element
  char?: '=' | '-';
  // Spacer / Feed element
  lines?: number;
  // Conditional rendering
  condition?: string;
  // Items list specific
  showNotes?: boolean;
  showKitchenNotes?: boolean;
  showOptions?: boolean;
  showPrice?: boolean;
}

export interface PrintTemplateDesign {
  paperWidth: 80 | 58;
  elements: TemplateElement[];
  generatedTemplate?: string;
}

// API types
export interface PrintTemplate {
  id: string;
  organizationId: string;
  name: string;
  type: PrintTemplateType;
  template: PrintTemplateDesign;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrintTemplateData {
  name: string;
  type: PrintTemplateType;
  template?: PrintTemplateDesign;
  isDefault?: boolean;
}

export interface UpdatePrintTemplateData {
  name?: string;
  template?: PrintTemplateDesign;
  isDefault?: boolean;
}

// Field metadata for the palette
export interface FieldDefinition {
  field: TemplateFieldType;
  labelKey: string;
  icon: string;
  category: 'organization' | 'order' | 'items' | 'payment' | 'other';
  defaultAlign?: TextAlign;
  defaultBold?: boolean;
  defaultBig?: boolean;
  defaultLabel?: string;
  defaultCondition?: string;
}

// Palette element (draggable source)
export interface PaletteItem {
  type: TemplateElementType;
  field?: TemplateFieldType;
  labelKey: string;
  icon: string;
  category: 'layout' | 'organization' | 'order' | 'items' | 'payment' | 'other';
}
