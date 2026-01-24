import type { UserOrganization } from './auth';

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
  userOrganizations?: UserOrganization[];
}

export interface AdminStats {
  totalUsers: number;
  totalOrganizations: number;
  activeOrganizations: number;
  totalEvents: number;
  activeEvents: number;
  totalRevenue: number;
}
