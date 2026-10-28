export type PrinterType = 'receipt' | 'kitchen' | 'label';

/** `bluetooth` was never implemented and is gone; `windows` = Windows spooler. */
export type PrinterConnectionType = 'network' | 'usb' | 'windows';

/** Paper widths the agent can print on. */
export type PrinterPaperWidth = 58 | 80;

/**
 * How the agent reaches the printer. Which fields are set depends on
 * `connectionType`: `network` -> ipAddress/port (default 9100),
 * `usb` -> usbVendorId/usbProductId/usbSerialNumber, `windows` -> windowsPrinterName.
 */
export interface PrinterConnectionConfig {
  ipAddress?: string;
  port?: number;
  usbVendorId?: string;
  usbProductId?: string;
  usbSerialNumber?: string;
  windowsPrinterName?: string;
  [key: string]: unknown;
}

export interface Printer {
  id: string;
  organizationId: string | null;
  name: string;
  type: PrinterType;
  connectionType: PrinterConnectionType;
  connectionConfig: PrinterConnectionConfig;
  /** Set for adopted printers (`usb:…`, `net:…`, `win:…`); null when created manually. */
  fingerprint: string | null;
  paperWidth: number;
  hasCashDrawer: boolean;
  /** The printer agent (device of type `printer_agent`) this printer hangs on. */
  deviceId: string | null;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Manually created printer — network only (for printers the scan doesn't find). */
export interface CreatePrinterData {
  deviceId: string;
  name: string;
  type: PrinterType;
  connectionConfig: { ipAddress: string; port?: number };
  paperWidth?: PrinterPaperWidth;
  hasCashDrawer?: boolean;
}

export interface UpdatePrinterData {
  name?: string;
  type?: PrinterType;
  paperWidth?: PrinterPaperWidth;
  hasCashDrawer?: boolean;
  isActive?: boolean;
  /** Only for printers with connectionType `network`. */
  connectionConfig?: { ipAddress?: string; port?: number };
}

/** What the agent reports about itself in `agentHeartbeat`. */
export interface PrinterAgentInfo {
  version?: string;
  os?: 'linux' | 'windows' | 'darwin' | string;
  arch?: string;
  hostname?: string;
  pythonVersion?: string;
  capabilities?: {
    usb?: boolean;
    mdns?: boolean;
    portscan?: boolean;
    spooler?: boolean;
  };
}

/** Entry of `GET /organizations/:orgId/printer-agents`. */
export interface PrinterAgent {
  deviceId: string;
  name: string;
  status: 'pending' | 'verified' | 'blocked';
  isOnline: boolean;
  lastSeenAt: string | null;
  agentInfo: PrinterAgentInfo | null;
  discoveredCount: number;
  printerCount: number;
}

export type DiscoveredVia = 'usb' | 'mdns' | 'portscan' | 'spooler' | 'manual';

/** Did the device answer the agent's ESC/POS model query (`GS I`)? */
export type DiscoveredEscpos = 'yes' | 'no' | 'unknown';

/** The agent's guess what kind of device it found. Only `receipt` (and ESC/POS `label`) printers work. */
export type DiscoveredKind = 'receipt' | 'label' | 'office' | 'unknown';

/** What the agent knows about a discovered printer — everything optional. */
export interface DiscoveredPrinterDetails {
  manufacturer?: string;
  product?: string;
  model?: string;
  serialNumber?: string;
  usbVendorId?: string;
  usbProductId?: string;
  ipAddress?: string;
  port?: number;
  hostname?: string;
  macAddress?: string;
  windowsPrinterName?: string;
  driverName?: string;
  escpos?: DiscoveredEscpos;
  kind?: DiscoveredKind;
  /** One line explaining `kind`, e.g. "antwortet auf ESC/POS-Modellabfrage". */
  kindReason?: string;
  [key: string]: unknown;
}

/** A printer an agent has found; usable only after adopting it (`printerId`). */
export interface DiscoveredPrinter {
  id: string;
  deviceId: string;
  organizationId: string;
  fingerprint: string;
  connectionType: PrinterConnectionType;
  displayName: string;
  details: DiscoveredPrinterDetails;
  discoveredVia: DiscoveredVia;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set once the printer has been adopted. */
  printerId: string | null;
}

export interface AdoptDiscoveredPrinterData {
  name: string;
  type: PrinterType;
  paperWidth: PrinterPaperWidth;
  hasCashDrawer: boolean;
}

export interface DiscoverPrintersData {
  /** Also scan the local /24 on port 9100. */
  subnetScan?: boolean;
}

/** Super admin overview (`GET /admin/printers`): agents and printers per organisation. */
export interface AdminPrinterOverviewAgent extends Omit<PrinterAgent, 'printerCount'> {
  printers: Printer[];
}

export interface AdminPrinterOverviewEntry {
  organization: { id: string; name: string } | null;
  agents: AdminPrinterOverviewAgent[];
}
