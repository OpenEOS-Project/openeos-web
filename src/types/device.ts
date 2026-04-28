// Device status
export type DeviceStatus = 'pending' | 'verified' | 'blocked';

// Device class/type
export type DeviceClass = 'pos' | 'display' | 'admin' | 'printer_agent';

// Display mode (sub-type for display devices)
export type DisplayMode = 'kitchen' | 'delivery' | 'menu' | 'pickup' | 'sales' | 'customer' | 'station';

// Service mode for POS devices
export type ServiceMode = 'table' | 'counter';

// Printer routing mode
export type PrinterMode = 'device' | 'category' | 'product';

// Device statistics
export interface DeviceStats {
  ordersCount: number;
  paymentsCount: number;
  revenueTotal: number;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

// Device entity
export interface Device {
  id: string;
  organizationId: string;
  name: string;
  type: DeviceClass;
  status: DeviceStatus;
  deviceToken?: string; // Only returned on registration
  verificationCode?: string; // Only returned on registration
  userAgent?: string;
  lastSeenAt?: string;
  verifiedAt?: string;
  verifiedById?: string;
  settings?: {
    sumupReaderId?: string;
    displayMode?: DisplayMode;
    serviceMode?: ServiceMode;
    printerMode?: PrinterMode;
    requirePin?: boolean;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

// Init device data (for TV apps - public endpoint, no org required)
export interface InitDeviceData {
  suggestedName?: string;
  userAgent?: string;
  deviceType?: DeviceClass;
}

// Init device response
export interface InitDeviceResponse {
  deviceId: string;
  deviceToken: string;
  verificationCode: string;
}

// Device status response (for polling)
export interface DeviceStatusResponse {
  status: DeviceStatus;
  deviceId: string;
  organizationId?: string;
  organizationName?: string;
  deviceClass?: DeviceClass;
  settings?: Record<string, unknown>;
}

// Device info (authenticated device - GET /devices/me)
export interface DeviceInfo {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  deviceClass: DeviceClass;
  status: DeviceStatus;
  settings?: {
    sumupReaderId?: string;
    displayMode?: DisplayMode;
    serviceMode?: ServiceMode;
    printerMode?: PrinterMode;
    requirePin?: boolean;
    [key: string]: unknown;
  };
}

// DTOs - Legacy (kept for compatibility with POS device flow)
export interface RegisterDeviceData {
  name: string;
  organizationSlug: string;
  userAgent?: string;
}

// Registration response - Legacy (kept for compatibility)
export interface DeviceRegistrationResponse {
  deviceId: string;
  deviceToken: string;
  verificationCode: string;
  organizationName: string;
}

export interface VerifyDeviceData {
  code: string;
}

export interface UpdateDeviceClassData {
  deviceClass: DeviceClass;
}

// Query params
export interface QueryDevicesParams {
  status?: DeviceStatus;
}

// Pending device lookup response (from /devices/lookup)
export interface PendingDeviceLookup {
  deviceId: string;
  suggestedName: string | null;
  userAgent: string | null;
  deviceType: DeviceClass;
  createdAt: string;
}

// Link device to organization data
export interface LinkDeviceData {
  code: string;
  organizationId: string;
  name?: string;
  deviceType?: DeviceClass;
}
