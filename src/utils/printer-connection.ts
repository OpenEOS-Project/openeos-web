import type {
  DiscoveredPrinter,
  Printer,
  PrinterAgentInfo,
  PrinterConnectionConfig,
  PrinterConnectionType,
} from '@/types/printer';

/**
 * Pure helpers for the printer page: how a connection, an agent or a
 * discovered printer is summarised in one line. Translated labels (the
 * connection kind, "offline", ...) stay in the components; these only
 * assemble the technical part so it reads the same everywhere.
 */

/** Separator between the parts of a summary. */
const SEP = ' · ';

function joinParts(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter((part) => part.length > 0)
    .join(SEP);
}

/** `04b8:0202` — USB ids as the agent reports them (hex, lower case). */
export function formatUsbId(vendorId?: string | null, productId?: string | null): string {
  const vendor = (vendorId ?? '').trim().toLowerCase().replace(/^0x/, '');
  const product = (productId ?? '').trim().toLowerCase().replace(/^0x/, '');
  if (!vendor && !product) return '';
  return `${vendor || '?'}:${product || '?'}`;
}

/** `192.168.1.50:9100` — port only when it differs from the default 9100. */
export function formatNetworkAddress(ipAddress?: string | null, port?: number | null): string {
  const ip = (ipAddress ?? '').trim();
  if (!ip) return '';
  if (port && port !== 9100) return `${ip}:${port}`;
  return ip;
}

/**
 * Technical summary of an adopted or manually created printer:
 * network -> `192.168.1.50:9100`, usb -> `04b8:0202 · SN ABC123`,
 * windows -> the spooler name. Empty when nothing is known.
 */
export function formatPrinterConnection(
  connectionType: PrinterConnectionType,
  config: PrinterConnectionConfig | null | undefined,
): string {
  const c = config ?? {};
  switch (connectionType) {
    case 'network':
      return formatNetworkAddress(c.ipAddress, c.port);
    case 'usb':
      return joinParts([
        formatUsbId(c.usbVendorId, c.usbProductId),
        c.usbSerialNumber ? `SN ${c.usbSerialNumber}` : '',
      ]);
    case 'windows':
      return (c.windowsPrinterName ?? '').trim();
    default:
      return '';
  }
}

/**
 * Technical summary of a discovered printer, from its `details`:
 * usb -> ids + serial, network -> address + hostname + MAC,
 * windows -> spooler name + driver.
 */
export function formatDiscoveredConnection(discovered: Pick<DiscoveredPrinter, 'connectionType' | 'details' | 'displayName'>): string {
  const d = discovered.details ?? {};
  switch (discovered.connectionType) {
    case 'usb':
      return joinParts([
        formatUsbId(d.usbVendorId, d.usbProductId),
        d.serialNumber ? `SN ${d.serialNumber}` : '',
      ]);
    case 'network':
      return joinParts([
        formatNetworkAddress(d.ipAddress, d.port),
        d.hostname,
        d.macAddress ? d.macAddress.toLowerCase() : '',
      ]);
    case 'windows':
      return joinParts([
        d.windowsPrinterName && d.windowsPrinterName !== discovered.displayName ? d.windowsPrinterName : '',
        d.driverName,
      ]);
    default:
      return '';
  }
}

/**
 * Does the agent think this is something it can print on? Receipt and
 * label printers by kind, plus anything that answered the ESC/POS model
 * query. Entries from agents that do not classify yet (no `kind`, no
 * `escpos`) count as usable so nothing disappears after an upgrade.
 */
export function isLikelyReceiptPrinter(discovered: Pick<DiscoveredPrinter, 'details'>): boolean {
  const d = discovered.details ?? {};
  if (d.escpos === 'yes') return true;
  if (d.kind === 'receipt' || d.kind === 'label') return true;
  if (d.kind === undefined && d.escpos === undefined) return true;
  return false;
}

/**
 * Splits the discovered list into what is shown by default (likely
 * receipt printers and everything already adopted) and what hides behind
 * "show all devices" (office printers and silent devices).
 */
export function partitionDiscoveredPrinters<T extends Pick<DiscoveredPrinter, 'details' | 'printerId'>>(
  discovered: readonly T[] | null | undefined,
): { shown: T[]; hidden: T[] } {
  const shown: T[] = [];
  const hidden: T[] = [];
  for (const item of discovered ?? []) {
    if (item.printerId || isLikelyReceiptPrinter(item)) shown.push(item);
    else hidden.push(item);
  }
  return { shown, hidden };
}

/** Manufacturer/model of a discovered printer when the agent knows it. */
export function formatDiscoveredModel(details: DiscoveredPrinter['details'] | null | undefined): string {
  const d = details ?? {};
  const manufacturer = (d.manufacturer ?? '').trim();
  const model = (d.model ?? d.product ?? '').trim();
  if (manufacturer && model && model.toLowerCase().startsWith(manufacturer.toLowerCase())) return model;
  return joinParts([manufacturer, model]).replace(SEP, ' ');
}

const OS_LABELS: Record<string, string> = {
  linux: 'Linux',
  windows: 'Windows',
  darwin: 'macOS',
};

/** `pi-kueche · Linux arm64 · v1.2.0` — what identifies the machine the agent runs on. */
export function formatAgentInfo(info: PrinterAgentInfo | null | undefined): string {
  if (!info) return '';
  const os = info.os ? OS_LABELS[info.os.toLowerCase()] ?? info.os : '';
  const platform = joinParts([os, info.arch]).replace(SEP, ' ');
  const version = info.version ? `v${info.version.replace(/^v/i, '')}` : '';
  return joinParts([info.hostname, platform, version]);
}

/** Only `network` printers have a connection the user can edit (IP/port). */
export function isConnectionEditable(connectionType: PrinterConnectionType): boolean {
  return connectionType === 'network';
}

/**
 * Printers offered in an assignment select (station, order flow, device):
 * active ones, plus the one currently assigned even if it was deactivated —
 * otherwise the select would silently show nothing for a stored value.
 */
export function selectablePrinters<T extends Pick<Printer, 'id' | 'isActive'>>(
  printers: readonly T[] | null | undefined,
  currentId?: string | null,
): T[] {
  return (printers ?? []).filter((p) => p.isActive || (currentId != null && p.id === currentId));
}
