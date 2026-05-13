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

/** Admin (cross-org) view of an assigned printer. */
export interface AdminAssignedPrinter extends Printer {
  organization: { id: string; name: string; slug: string; logoUrl: string | null } | null;
}

export interface PrinterPreviousConfig {
  printerId: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connectionType: 'network' | 'usb' | 'bluetooth';
  connectionConfig: Record<string, unknown>;
  paperWidth: number;
  hasCashDrawer: boolean;
}

/** Admin view of a printer-agent device that has not been assigned to an organisation yet. */
export interface AdminUnassignedPrinterDevice {
  id: string;
  name: string;
  suggestedName?: string | null;
  type: 'printer_agent';
  status: string;
  lastSeenAt: string | null;
  createdAt?: string;
  /**
   * Set when this device used to have a Printer row (e.g. it was assigned, then
   * unassigned). Lets the assignment modal pre-fill name/paperWidth/USB IDs so
   * the operator doesn't have to redo the setup.
   */
  previousConfig?: PrinterPreviousConfig | null;
}

export interface AdminPrintersResponse {
  assigned: AdminAssignedPrinter[];
  unassigned: AdminUnassignedPrinterDevice[];
}

export interface AssignPrinterDeviceData {
  deviceId: string;
  organizationId: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connectionType: 'network' | 'usb' | 'bluetooth';
  connectionConfig?: Record<string, unknown>;
  paperWidth?: number;
  hasCashDrawer?: boolean;
}
