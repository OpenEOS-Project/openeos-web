export interface Printer {
  id: string;
  organizationId: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connectionType: 'network' | 'usb' | 'bluetooth';
  connectionConfig: Record<string, unknown>;
  paperWidth: number;
  hasCashDrawer: boolean;
  deviceId: string | null;
  device?: { id: string; name: string; status: string } | null;
  rentalAssignmentId: string | null;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePrinterData {
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connectionType: 'network' | 'usb' | 'bluetooth';
  connectionConfig?: Record<string, unknown>;
  paperWidth?: number;
  hasCashDrawer?: boolean;
  deviceId?: string | null;
}

export interface UpdatePrinterData {
  name?: string;
  type?: 'receipt' | 'kitchen' | 'label';
  connectionType?: 'network' | 'usb' | 'bluetooth';
  connectionConfig?: Record<string, unknown>;
  paperWidth?: number;
  hasCashDrawer?: boolean;
  deviceId?: string | null;
}
