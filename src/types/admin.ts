import type { EventInvoiceStatus } from './billing';

export interface AdminUserOrganization {
  id: string;
  role: string;
  organization: {
    id: string;
    name: string;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  /** Eigene Höchstzahl an Organisationen; null = Standard der Installation, 0 = unbegrenzt. */
  organizationLimit?: number | null;
  createdAt: string;
  updatedAt: string;
  userOrganizations?: AdminUserOrganization[];
}

export interface AdminOverviewStats {
  totalOrganizations: number;
  totalUsers: number;
  totalCredits: number;
  pendingPurchases: number;
  activeEvents: number;
  newUsersThisMonth: number;
  newOrganizationsThisMonth: number;
}

export interface AdminRevenueStats {
  totalRevenue: number;
  /** Unlocked events (paid or invoiced) — the platform's only revenue stream. */
  eventRevenue: number;
}

export interface AdminEventListItem {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  orderCount: number;
  revenueTotal: number;
  invoicedAt: string | null;
  invoicedBy: string | null;
  invoiceNote: string | null;
  billingStatus?: 'none' | 'pending' | 'paid' | 'invoice' | 'waived';
  /** Auf Rechnung über Stripe: die Rechnung. Fehlt bei Altfällen (manuell abgerechnet). */
  stripeInvoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: EventInvoiceStatus | 'overdue' | null;
  invoiceDueAt?: string | null;
  invoicePaidAt?: string | null;
  invoiceHostedUrl?: string | null;
  /** Ob Stripe ein PDF hat — geladen wird es über /admin/events/:id/invoice/pdf. */
  invoiceHasPdf?: boolean;
  priceCharged?: number | null;
}

export interface AdminEventOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
}

export interface AdminEventDetail extends AdminEventListItem {
  orders: AdminEventOrderSummary[];
}

export interface AdminNotifyOnSettings {
  userRegistered: boolean;
  organizationCreated: boolean;
  eventOrdered: boolean;
  supportMessage: boolean;
  contactRequest: boolean;
}

export interface AdminNotificationSettings {
  email: string | null;
  notifyOn: AdminNotifyOnSettings;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  organizationId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  reason: string | null;
  ipAddress: string;
  createdAt: string;
  adminUser?: { id: string; firstName: string; lastName: string; email: string };
  organization?: { id: string; name: string } | null;
}
