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
  /** Abgerechnete Veranstaltungstage (6 bis 6 Uhr, siehe businessDayStartHour). */
  days: number;
  /** Stunde, zu der ein Veranstaltungstag wechselt (Ortszeit der Organisation). */
  businessDayStartHour?: number;
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
  /** Wann bezahlt bzw. auf Rechnung bestellt wurde. */
  paidAt: string | null;
  /** Der tatsächlich berechnete Betrag — `finalPrice` ist nur der heutige Preis. */
  priceCharged: number | null;
  /** Ob und bis wann sich die Freischaltung kostenlos stornieren lässt. */
  cancellation: EventUnlockCancellationInfo;
  /** Die letzte Stornierung dieser Veranstaltung, falls es eine gab. */
  lastCancellation: EventUnlockCancellation | null;
}

/** Warum die Freischaltung gerade nicht storniert werden kann. */
export type EventUnlockCancellationBlock =
  | 'not_paid'
  | 'deadline_passed'
  | 'has_orders'
  | 'online_refund_unavailable';

export interface EventUnlockCancellationInfo {
  allowed: boolean;
  /**
   * Bis wann kostenlos storniert werden kann (ISO). Steht auch vor dem
   * Bezahlen schon da — der Bezahldialog nennt die Frist.
   */
  deadline: string | null;
  /** Zeitzone der Organisation — die Frist wird darin angezeigt. */
  timezone: string;
  blockedReason: EventUnlockCancellationBlock | null;
}

export type EventRefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'requires_action';

export interface EventUnlockCancellation {
  id: string;
  cancelledAt: string;
  amount: number;
  currency: string;
  /** Wie die Freischaltung bezahlt war: über Stripe oder auf Rechnung. */
  previousBillingStatus: 'paid' | 'invoice';
  /** Stand der Erstattung bei Stripe; null bei Zahlung auf Rechnung. */
  refundStatus: EventRefundStatus | null;
  /** Nummer der Stornorechnung, sofern Stripe eine ausgestellt hat. */
  creditNoteNumber: string | null;
  /**
   * Storno (Freischaltung aufgehoben) oder Kulanz durch die Plattform
   * (Erstattung, Freischaltung bleibt). Ältere APIs liefern das Feld nicht.
   */
  kind?: 'cancellation' | 'goodwill';
  /** Begründung der Plattform. */
  reason?: string | null;
}

/** Vorschau für Storno/Kulanz durch den Super-Admin. */
export interface PlatformCancellationPreview {
  eventId: string;
  billingStatus: string;
  via: 'stripe' | 'invoice' | null;
  currency: string;
  amountCharged: number;
  /** Seit dieser Freischaltung schon per Kulanz erstattet. */
  refundedSoFar: number;
  /** Höchstens noch erstattbar. */
  refundable: number;
  /** Echte Bestellungen (ohne Testbestellungen). */
  realOrders: number;
  deadline: string | null;
  /** Zeitzone der Organisation — die Frist wird darin angezeigt. */
  timezone: string;
  deadlinePassed: boolean;
  /** Kauf auf Rechnung: Rechnung schon gestellt. */
  invoiced: boolean;
  onlineRefundAvailable: boolean;
}

export interface EventUnlockCancellationResult {
  cancellation: EventUnlockCancellation;
  billing: EventBilling;
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

/** Eine von Stripe ausgestellte Rechnung oder Stornorechnung. */
export interface OrganizationInvoice {
  id: string;
  /** Rechnung oder Stornorechnung (Gutschrift zu einer Rechnung). */
  kind: 'invoice' | 'credit_note';
  /** Bei einer Stornorechnung: die Nummer der Rechnung, die sie aufhebt. */
  relatedInvoiceNumber: string | null;
  /** Fortlaufende Rechnungsnummer von Stripe. Entwürfe haben noch keine. */
  number: string | null;
  issuedAt: string | null;
  total: number;
  currency: string;
  status: string;
  paid: boolean;
  description: string | null;
  hostedUrl: string | null;
  hasPdf: boolean;
}

/** Was eine Veranstaltung kosten wird, bevor es sie gibt. */
export interface EventPricePreview {
  pricePerDay: number;
  days: number;
  /** Stunde, zu der ein Veranstaltungstag wechselt (Ortszeit der Organisation). */
  businessDayStartHour?: number;
  price: number;
  discountPercent: number;
  discountReason: EventDiscountReason;
  finalPrice: number;
  /** Bis zu so vielen Bestellungen laesst sich kostenlos testen. */
  testEventMaxOrders: number;
}
