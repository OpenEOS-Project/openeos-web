// Event billing (Kauf auf Rechnung, Phase 1)
export type EventBillingMode = 'prepaid' | 'invoice';
export type EventBillingStatus = 'none' | 'pending' | 'paid' | 'invoice' | 'waived';

export interface BillingAddressDetails {
  name?: string;
  street: string;
  zip: string;
  city: string;
}

export interface EventBilling {
  price: number;
  discountPercent: number;
  finalPrice: number;
  billingMode: EventBillingMode;
  billingStatus: EventBillingStatus;
  organizationName: string;
  billingEmail: string | null;
  billingAddress: BillingAddressDetails | null;
}

export interface OrderInvoiceData {
  billingName: string;
  billingEmail: string;
  billingAddress: {
    street: string;
    zip: string;
    city: string;
  };
}

export interface CompanySearchResultItem {
  name: string;
  registerNumber: string;
  address: {
    street: string;
    zip: string;
    city: string;
  };
}

export interface CompanySearchResponse {
  enabled: boolean;
  results: CompanySearchResultItem[];
}
