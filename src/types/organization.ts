/** Alle Integrationen, die der Katalog kennt (src/config/integrations.ts). */
export type IntegrationId = 'sumup' | 'stripe' | 'tse';

export interface IntegrationState {
  enabled: boolean;
  /** Zeitpunkt der letzten Aktivierung (ISO), setzt die API. */
  enabledAt?: string;
}

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
  /** Weist die Organisation Umsatzsteuer aus? Vereine und Kleinunternehmer nicht. */
  vatExempt?: boolean;
  /** Impressum und Datenschutzhinweis fuer Shop und Helferseiten. */
  legal?: import('@/lib/legal').OrganizationLegalSettings;
  pos?: {
    requireTableNumber: boolean;
    autoPrintReceipt: boolean;
    soundEnabled: boolean;
    orderingMode?: 'immediate' | 'tab';
  };
  pfand?: {
    tableService?: boolean;
    counterPickup?: boolean;
  };
  /**
   * Zahlungsarten. `cashless: true` = bargeldloser Modus: die API sperrt
   * jede Barzahlung, Bar-Erstattung und Pfand-Auszahlung (keine TSE nötig).
   */
  payments?: {
    cashless?: boolean;
    /** Letzte Umschaltung (ISO-Zeitpunkt). */
    changedAt?: string;
  };
  /**
   * Assistent-Funktionen (Speisekarten-Import, Icon-Vorschläge): Opt-in
   * der Organisation, schaltet ein Admin über `PATCH …/assistant`.
   */
  assistant?: {
    enabled: boolean;
    enabledAt?: string;
    enabledByUserId?: string;
  };
  onlineOrdering?: {
    enabled: boolean;
    requirePayment: boolean;
    maxItemsPerOrder: number;
  };
  /**
   * Ein- und ausgeschaltete Integrationen. Aktiv ist eine Integration nur bei
   * `enabled === true`; die Zugangsdaten (z. B. `sumup`) bleiben beim
   * Ausschalten stehen, damit ein erneutes Einschalten ohne Neueinrichtung
   * geht.
   */
  integrations?: Partial<Record<IntegrationId, IntegrationState>>;
  sumup?: {
    apiKey: string;
    merchantCode: string;
    affiliateKey?: string;
    appId?: string;
  };
  orderFlow?: {
    receiptPrinting?: {
      enabled: boolean;
      trigger: 'payment_received' | 'order_completed' | 'manual';
      printerId: string | null;
      templateId: string | null;
    };
    kitchenTicketPrinting?: {
      enabled: boolean;
      printerId: string | null;
      templateId: string | null;
      /** per_order = full order on one ticket (default), per_item = one ticket per
       *  OrderItem (incl. barcode), per_station = one ticket per production station. */
      mode?: 'per_order' | 'per_item' | 'per_station';
    };
    orderTicketPrinting?: {
      enabled: boolean;
      printerId: string | null;
      templateId: string | null;
    };
    kitchenDisplay?: { enabled: boolean };
    customerDisplay?: { enabled: boolean };
    autoComplete?: { enabled: boolean };
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
  /** Kauf auf Rechnung (Phase 1): wie Events dieser Organisation abgerechnet werden. */
  billingMode?: 'prepaid' | 'invoice';
  /** Individueller Preis pro Veranstaltung; leer/null = Standardpreis. */
  eventPriceOverride?: number | null;
  /** Zahlungsziel für Rechnungen in Tagen; null = Standard der Plattform. */
  invoiceDaysUntilDue?: number | null;
  /** Bevorzugte Bearbeitung im Support-Chat (Super-Admin-Flag). */
  prioritySupport?: boolean;
  /**
   * Höchstzahl an Mitgliedern (aktive plus offene Einladungen). In
   * GET /organizations/:id die wirksame Schranke (0 = unbegrenzt); im
   * Adminbereich der rohe Wert, null = Standard der Installation.
   */
  memberLimit?: number | null;
  /** Nur in GET /organizations/:id: belegte Plätze inkl. offener Einladungen. */
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationData {
  name: string;
  settings?: Partial<OrganizationSettings>;
}

export interface UpdateOrganizationData {
  name?: string;
  logoUrl?: string | null;
  settings?: Partial<OrganizationSettings>;
  billingEmail?: string;
  billingAddress?: BillingAddress;
  vatId?: string;
}

/** Eintrag im Verlauf des bargeldlosen Modus. */
export interface CashlessChange {
  id: string;
  createdAt: string;
  /** Neuer Zustand ab diesem Zeitpunkt. */
  cashless: boolean;
  /** „Vorname Nachname (E-Mail)“ zum Zeitpunkt der Änderung. */
  changedByName: string | null;
}
