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

