// User Preferences
export type ThemePreference = 'light' | 'dark' | 'system';
export type LocalePreference = 'de' | 'en';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  locale: LocalePreference;
  notifications: NotificationPreferences;
}

// 2FA Types
export type TwoFactorMethod = 'totp' | 'email';

export interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod | null;
  hasRecoveryCodes: boolean;
}

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
}

export interface RecoveryCodesResult {
  recoveryCodes: string[];
}

export interface TrustedDevice {
  id: string;
  deviceName: string;
  lastUsedAt: Date;
  createdAt: Date;
}

// Session Types
export interface UserSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

// Organization Settings
export interface OrganizationBrandingSettings {
  primaryColor?: string;
  secondaryColor?: string;
  receiptLogo?: string;
}

export interface OrganizationNotificationSettings {
  emailOrderConfirmation: boolean;
  emailDailySummary: boolean;
  pushNewOrders: boolean;
}

export interface OrganizationDefaultSettings {
  defaultTaxRate: number;
  defaultPrinterId?: string;
  requirePinForRefunds: boolean;
}

export interface OrganizationSettings {
  branding: OrganizationBrandingSettings;
  notifications: OrganizationNotificationSettings;
  defaults: OrganizationDefaultSettings;
}

// Subscription Config (Admin)
export interface SubscriptionConfig {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  creditsPerMonth: number;
  isActive: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Billing Types
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';

export interface SubscriptionInfo {
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  priceMonthly: number | null;
  creditsPerMonth: number | null;
}

export interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export interface BillingOverview {
  subscription: SubscriptionInfo;
  credits: number;
  packages: CreditPackage[];
}

export interface CreditPurchase {
  id: string;
  packageId: string;
  credits: number;
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  completedAt: Date | null;
  createdAt: Date;
  package?: CreditPackage;
}

// DTO Types for API calls
export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeEmailDto {
  newEmail: string;
  password: string;
}

export interface VerifyEmailChangeDto {
  token: string;
}

export interface UpdatePreferencesDto {
  theme?: ThemePreference;
  locale?: LocalePreference;
  notifications?: Partial<NotificationPreferences>;
}

export interface VerifyTotpSetupDto {
  token: string;
}

export interface VerifyEmailOtpSetupDto {
  code: string;
}

export interface Verify2FADto {
  code: string;
  trustDevice?: boolean;
  deviceFingerprint?: string;
  deviceInfo?: string;
}

export interface Disable2FADto {
  password: string;
}

export interface CreateCheckoutDto {
  packageId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalSessionDto {
  returnUrl: string;
}
