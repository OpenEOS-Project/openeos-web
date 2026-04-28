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
  createdAt: string;
  updatedAt: string;
  userOrganizations?: AdminUserOrganization[];
}

export interface AdminOverviewStats {
  totalOrganizations: number;
  totalUsers: number;
  totalCredits: number;
  pendingPurchases: number;
  activeRentals: number;
  activeEvents: number;
  newUsersThisMonth: number;
  newOrganizationsThisMonth: number;
}

export interface AdminRevenueStats {
  totalRevenue: number;
  creditRevenue: number;
  rentalRevenue: number;
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
