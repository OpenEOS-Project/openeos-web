import { expect, test } from '@playwright/test';

import {
  formatAgentInfo,
  formatDiscoveredConnection,
  formatDiscoveredModel,
  formatNetworkAddress,
  formatPrinterConnection,
  formatUsbId,
  isConnectionEditable,
  selectablePrinters,
} from '@/utils/printer-connection';

test.describe('formatUsbId / formatNetworkAddress', () => {
  test('normalisiert USB-Kennungen auf hex in Kleinbuchstaben', () => {
    expect(formatUsbId('04B8', '0x0202')).toBe('04b8:0202');
    expect(formatUsbId('04b8', undefined)).toBe('04b8:?');
    expect(formatUsbId(undefined, undefined)).toBe('');
  });

  test('zeigt den Port nur, wenn er vom Standard 9100 abweicht', () => {
    expect(formatNetworkAddress('192.168.1.50', 9100)).toBe('192.168.1.50');
    expect(formatNetworkAddress('192.168.1.50', 9101)).toBe('192.168.1.50:9101');
    expect(formatNetworkAddress('192.168.1.50', undefined)).toBe('192.168.1.50');
    expect(formatNetworkAddress('', 9100)).toBe('');
  });
});

test.describe('formatPrinterConnection', () => {
  test('Netzwerk: Adresse aus connectionConfig', () => {
    expect(formatPrinterConnection('network', { ipAddress: '10.0.0.7', port: 9100 })).toBe('10.0.0.7');
    expect(formatPrinterConnection('network', { ipAddress: '10.0.0.7', port: 9200 })).toBe('10.0.0.7:9200');
  });

  test('USB: Kennung und Seriennummer', () => {
    expect(
      formatPrinterConnection('usb', { usbVendorId: '04b8', usbProductId: '0202', usbSerialNumber: 'X7' }),
    ).toBe('04b8:0202 · SN X7');
    expect(formatPrinterConnection('usb', { usbVendorId: '04b8', usbProductId: '0202' })).toBe('04b8:0202');
  });

  test('Windows: Name im Spooler', () => {
    expect(formatPrinterConnection('windows', { windowsPrinterName: 'EPSON TM-T88V' })).toBe('EPSON TM-T88V');
  });

  test('kommt ohne connectionConfig zurecht', () => {
    expect(formatPrinterConnection('network', null)).toBe('');
    expect(formatPrinterConnection('usb', undefined)).toBe('');
    expect(formatPrinterConnection('windows', {})).toBe('');
  });
});

test.describe('formatDiscoveredConnection', () => {
  test('Netzwerk: Adresse, Hostname und MAC', () => {
    expect(
      formatDiscoveredConnection({
        connectionType: 'network',
        displayName: 'TM-T88V',
        details: { ipAddress: '192.168.1.50', port: 9100, hostname: 'epson-kueche', macAddress: 'AA:BB:CC:DD:EE:FF' },
      }),
    ).toBe('192.168.1.50 · epson-kueche · aa:bb:cc:dd:ee:ff');
  });

  test('USB: Kennung und Seriennummer', () => {
    expect(
      formatDiscoveredConnection({
        connectionType: 'usb',
        displayName: 'EPSON TM-T20III',
        details: { usbVendorId: '04b8', usbProductId: '0e28', serialNumber: 'ABC123' },
      }),
    ).toBe('04b8:0e28 · SN ABC123');
  });

  test('Windows: Spooler-Name nur, wenn er vom Anzeigenamen abweicht, plus Treiber', () => {
    expect(
      formatDiscoveredConnection({
        connectionType: 'windows',
        displayName: 'Bondrucker Theke',
        details: { windowsPrinterName: 'Bondrucker Theke', driverName: 'Generic / Text Only' },
      }),
    ).toBe('Generic / Text Only');
    expect(
      formatDiscoveredConnection({
        connectionType: 'windows',
        displayName: 'Theke',
        details: { windowsPrinterName: 'EPSON TM-T88V Receipt', driverName: 'Generic / Text Only' },
      }),
    ).toBe('EPSON TM-T88V Receipt · Generic / Text Only');
  });
});

test.describe('formatDiscoveredModel', () => {
  test('setzt Hersteller und Modell zusammen, ohne den Hersteller zu doppeln', () => {
    expect(formatDiscoveredModel({ manufacturer: 'EPSON', model: 'TM-T88V' })).toBe('EPSON TM-T88V');
    expect(formatDiscoveredModel({ manufacturer: 'EPSON', model: 'EPSON TM-T88V' })).toBe('EPSON TM-T88V');
    expect(formatDiscoveredModel({ manufacturer: 'Star', product: 'TSP143' })).toBe('Star TSP143');
    expect(formatDiscoveredModel({})).toBe('');
    expect(formatDiscoveredModel(null)).toBe('');
  });
});

test.describe('formatAgentInfo', () => {
  test('Rechner, Plattform und Version', () => {
    expect(
      formatAgentInfo({ hostname: 'pi-kueche', os: 'linux', arch: 'arm64', version: '1.2.0' }),
    ).toBe('pi-kueche · Linux arm64 · v1.2.0');
    expect(formatAgentInfo({ hostname: 'KASSE-PC', os: 'windows', arch: 'x86_64', version: 'v2.0.0' })).toBe(
      'KASSE-PC · Windows x86_64 · v2.0.0',
    );
  });

  test('lässt fehlende Teile weg', () => {
    expect(formatAgentInfo({ os: 'darwin' })).toBe('macOS');
    expect(formatAgentInfo({ version: '1.0.0' })).toBe('v1.0.0');
    expect(formatAgentInfo(null)).toBe('');
    expect(formatAgentInfo({})).toBe('');
  });
});

test.describe('isConnectionEditable / selectablePrinters', () => {
  test('nur Netzwerkdrucker haben eine editierbare Verbindung', () => {
    expect(isConnectionEditable('network')).toBe(true);
    expect(isConnectionEditable('usb')).toBe(false);
    expect(isConnectionEditable('windows')).toBe(false);
  });

  test('bietet aktive Drucker an, behält aber den bereits zugewiesenen', () => {
    const printers = [
      { id: 'a', isActive: true },
      { id: 'b', isActive: false },
      { id: 'c', isActive: false },
    ];
    expect(selectablePrinters(printers).map((p) => p.id)).toEqual(['a']);
    expect(selectablePrinters(printers, 'b').map((p) => p.id)).toEqual(['a', 'b']);
    expect(selectablePrinters(printers, 'zzz').map((p) => p.id)).toEqual(['a']);
    expect(selectablePrinters(undefined, 'a')).toEqual([]);
  });
});
