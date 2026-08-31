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
