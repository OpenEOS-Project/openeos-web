export interface OrganizationSettings {
  currency: string;
  timezone: string;
  locale: string;
  taxId?: string;
  description?: string;
  address?: {
    street: string;
    city: string;
    zip: string;
    country: string;
  };
  contact?: {
    address?: string;
    city?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
    website?: string;
  };
  receipt?: {
    headerText?: string;
    footerText?: string;
    showTaxDetails: boolean;
  };
  pos?: {
    requireTableNumber: boolean;
    autoPrintReceipt: boolean;
    soundEnabled: boolean;
    orderingMode: 'immediate' | 'tab';
  };
  onlineOrdering?: {
    enabled: boolean;
    requirePayment: boolean;
    maxItemsPerOrder: number;
  };
}

export interface BillingAddress {
  company?: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

export type DiscountType = 'all' | 'credits' | 'hardware';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: OrganizationSettings;
  eventCredits: number;
  billingEmail: string | null;
  billingAddress: BillingAddress | null;
  vatId: string | null;
  supportPin: string;
  discountPercent: number | null;
  discountType: DiscountType | null;
  discountValidUntil: string | null;
  discountNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationData {
  name: string;
  settings?: Partial<OrganizationSettings>;
}

export interface UpdateOrganizationData {
  name?: string;
  settings?: Partial<OrganizationSettings>;
  billingEmail?: string;
  billingAddress?: BillingAddress;
  vatId?: string;
}
