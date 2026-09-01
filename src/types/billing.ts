// Event billing (Kauf auf Rechnung, Phase 1)
export type EventBillingMode = 'prepaid' | 'invoice';
export type EventBillingStatus = 'none' | 'pending' | 'paid' | 'invoice' | 'waived';

export interface BillingAddressDetails {
  name?: string;
  street: string;
  zip: string;
  city: string;
}

/** Woher der Nachlass stammt — bestimmt nur die Beschriftung. */
export type EventDiscountReason = 'first-event' | 'organization' | null;

export interface EventBilling {
  /** Preis je Veranstaltungstag, vor Nachlass. */
  pricePerDay: number;
  /** Abgerechnete Veranstaltungstage. */
  days: number;
  /** pricePerDay × days, vor Nachlass. */
  price: number;
  discountPercent: number;
  discountReason: EventDiscountReason;
  finalPrice: number;
  /** Ob Stripe konfiguriert ist — sonst bleibt nur der Kauf auf Rechnung. */
  onlinePaymentAvailable: boolean;
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
