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
