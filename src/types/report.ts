// Response shapes of /organizations/:orgId/reports/* — mirror
// openeos-api/src/modules/reports/reports.service.ts interfaces.

export interface ReportQuery {
  eventId?: string;
  startDate?: string;
  endDate?: string;
}

export interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalItemsSold: number;
  pfandCollected: number;
  pfandReturned: number;
  pfandBalance: number;
  cancelledOrders: number;
  cancellationRate: number;
}

/**
 * Umsatz und Umsatzsteuer je Steuersatz (`GET reports/vat`). Pfand gehört
 * zum Entgelt und steht beim Satz seiner Pfandart, Pfand-Rückgaben mindern
 * ihn (negativ). Buchungen von vor 2026-11 ohne Satz stehen bei 0 %.
 * Trinkgeld ist kein Entgelt und fehlt.
 */
export interface VatReportRow {
  rate: number;
  goods: number;
  deposits: number;
  /** Pfand-Rückgaben (negativ); gegen den Altsaldo bei 0 %. */
  depositReturns: number;
  /** Trinkgeld an den Verein (TrinkgeldAG), anteilig je Satz (ältere API: fehlt). */
  tips?: number;
  /**
   * Einzweck-Wertmarken (§ 3 Abs. 14 UStG): Steuer beim Verkauf — verkauft
   * − eingelöst + bei Storno zurückgegeben − zurückgetauscht (ältere API: fehlt).
   */
  singlePurposeTokens?: number;
  gross: number;
  tax: number;
  net: number;
}

export interface VatReport {
  /** Organisation weist keine Umsatzsteuer aus (Kleinunternehmer). */
  vatExempt: boolean;
  rows: VatReportRow[];
  total: Omit<VatReportRow, 'rate'>;
  /** Trinkgeld angestellter Bedienungen (TrinkgeldAN, nicht steuerbar), nachrichtlich. */
  employeeTips?: number;
  /**
   * Mehrzweck-Wertmarken (§ 3 Abs. 15 UStG), nachrichtlich: Verkauf und
   * Rücktausch (negativ) sind nicht steuerbar (ältere API: fehlt).
   */
  multiPurposeTokens?: { sold: number; boughtBack: number };
}

/** GET reports/small-business: Umsatz in OpenEOS gegen die Grenzen des § 19 UStG. */
export interface SmallBusinessStatus {
  vatExempt: boolean;
  year: number;
  currentYearRevenue: number;
  previousYearRevenue: number;
  /** 100.000 € */
  limitCurrentYear: number;
  /** 25.000 € */
  limitPreviousYear: number;
  /** Anteil an `limitCurrentYear` (0..n). */
  ratio: number;
  /** Nur für Kleinunternehmer: ab 80 % `approaching`, darüber `exceeded`. */
  warning: 'approaching' | 'exceeded' | null;
}

/**
 * Abgleich der Produkt- und Kategorieberichte mit dem Umsatz netto
 * (`GET reports/net-summary`): Produkte + Erstattungen ohne Position +
 * Trinkgeld = Umsatz netto (`SalesReport.totalRevenue`).
 */
export interface NetSalesSummary {
  /** Warenwert netto aller Positionen. */
  itemsRevenue: number;
  /** Kulanz-Erstattungen ohne Positionsbezug (negativ). */
  unassignedRefunds: number;
  /** Trinkgeld abzüglich erstattetem Trinkgeld. */
  tips: number;
  netRevenue: number;
}

/** Produkte netto: Storno und erstattete Mengen abgezogen, Rabatt anteilig, ohne Pfand. */
export interface ProductReport {
  productId: string;
  productName: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
}

export interface PaymentReport {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface HourlyReport {
  /** Lokales Datum (YYYY-MM-DD); mehrtägige Veranstaltungen liefern mehrere Tage */
  date: string;
  hour: number;
  orders: number;
  revenue: number;
}

export interface StockMovementReport {
  productId: string;
  productName: string;
  openingStock: number;
  additions: number;
  deductions: number;
  closingStock: number;
}

export interface InventoryLevel {
  productId: string;
  productName: string;
  currentStock: number;
  lowStock: boolean;
}

export interface ChannelReport {
  channel: string;
  orders: number;
  revenue: number;
  avgReceipt: number;
}

export interface CategoryReport {
  categoryId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DeviceReport {
  deviceId: string;
  name: string;
  orders: number;
  revenue: number;
}

/**
 * Systemstatus fuer die Statusleiste des Dashboards.
 *
 * Die Designvorlage zeigt an vierter Stelle eine TSE-Kachel. OpenEOS hat
 * keine TSE, deshalb steht dort openOrders — eine Zahl, die es wirklich
 * gibt.
 */
export interface SystemStatus {
  pos: { online: number; total: number };
  printers: { online: number; total: number };
  printQueue: { queued: number; completedLastHour: number };
  openOrders: number;
  generatedAt: string;
}

/** Eintrag im Ereignisstrom des Dashboards. */
export interface ActivityEntry {
  id: string;
  /** ISO-Zeitstempel */
  at: string;
  kind: 'order' | 'payment' | 'print';
  tone: 'neutral' | 'ok' | 'error';
  message: string;
  amount: number | null;
}
