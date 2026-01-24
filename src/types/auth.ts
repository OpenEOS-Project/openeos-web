import type { Organization } from './organization';

// Matches backend OrganizationRole enum
export type OrganizationRole = 'admin' | 'manager' | 'cashier' | 'kitchen' | 'delivery';

export interface OrganizationPermissions {
  canManageProducts?: boolean;
  canManageOrders?: boolean;
  canProcessPayments?: boolean;
  canViewReports?: boolean;
  canManageDevices?: boolean;
  canManageWorkflows?: boolean;
  [key: string]: boolean | undefined;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  permissions: OrganizationPermissions;
  createdAt: string;
  updatedAt: string;
  user?: User;
  organization?: Organization;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  userOrganizations: UserOrganization[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface TwoFactorRequiredResponse {
  twoFactorRequired: true;
  twoFactorMethod: 'totp' | 'email';
  twoFactorToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorRequiredResponse;

export function isTwoFactorRequired(response: LoginResponse): response is TwoFactorRequiredResponse {
  return 'twoFactorRequired' in response && response.twoFactorRequired === true;
}

export interface PendingInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  organization?: Organization;
}
