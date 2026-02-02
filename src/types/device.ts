// Device status
export type DeviceStatus = 'pending' | 'verified' | 'blocked';

// Device class/type
export type DeviceClass = 'pos' | 'display_kitchen' | 'display_delivery' | 'display_menu' | 'display_pickup' | 'display_sales' | 'admin';

// Device entity
export interface Device {
  id: string;
  organizationId: string;
  name: string;
  deviceClass: DeviceClass;
  status: DeviceStatus;
  deviceToken?: string; // Only returned on registration
  verificationCode?: string; // Only returned on registration
  userAgent?: string;
  lastSeen?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Registration response (from device perspective)
export interface DeviceRegistrationResponse {
  deviceId: string;
  deviceToken: string;
  verificationCode: string;
  organizationName: string;
}

// Device status response
export interface DeviceStatusResponse {
  status: DeviceStatus;
  deviceId: string;
  organizationId?: string;
  organizationName?: string;
  deviceClass?: DeviceClass;
}

// Device info (authenticated device)
export interface DeviceInfo {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  deviceClass: DeviceClass;
  status: DeviceStatus;
}

// DTOs
export interface RegisterDeviceData {
  name: string;
  organizationSlug: string;
  userAgent?: string;
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
