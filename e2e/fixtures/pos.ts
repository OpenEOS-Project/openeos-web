import type { APIRequestContext, BrowserContextOptions, Page } from '@playwright/test';

import { apiLogin, apiPost, ensureOk, newApiContext } from './api';
import { TEST_ADMIN } from './test-data';

/*
 * Vorbereitung der Kassen-Tests ueber die API: Veranstaltung mit Tischmodus,
 * Produkte, Tische und ein gekoppeltes Kassengeraet. Das Koppeln selbst
 * prueft e2e/pos/pos.spec.ts ueber die Oberflaeche; hier geht es schneller
 * ueber POST /devices/init + /devices/link.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

export interface PosAdmin {
  api: APIRequestContext;
  headers: Record<string, string>;
  organizationId: string;
}

export async function posAdmin(): Promise<PosAdmin> {
  const api = await newApiContext();
  const admin = await apiLogin(api, TEST_ADMIN.email, TEST_ADMIN.password);
  return { api, headers: admin.headers, organizationId: admin.organizationId! };
}

/** Drei Grossbuchstaben: Tischbezeichnungen ohne Ziffern im Praefix (Nummernsuche). */
export function letterStamp(): string {
  return Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
}

export interface PosEventOptions {
  name: string;
  tables: { mode: 'none' | 'free' | 'predefined'; areaIds?: string[] | null };
  orderingMode: 'immediate' | 'tab';
  products: Array<{ name: string; price: number }>;
}

/** Veranstaltung anlegen, aktivieren, Tischmodus setzen, eine Kategorie mit Produkten. */
export async function createPosEvent(admin: PosAdmin, options: PosEventOptions) {
  const org = admin.organizationId;
  const event = await apiPost(admin.api, `organizations/${org}/events`, admin.headers, {
    name: options.name,
    startDate: '2026-03-01',
  });
  await apiPost(admin.api, `organizations/${org}/events/${event.id}/activate`, admin.headers);
  await setEventSettings(admin, event.id, { tables: options.tables, orderingMode: options.orderingMode });
  const category = await apiPost(admin.api, `events/${event.id}/categories`, admin.headers, { name: 'Getränke' });
  const productIds: Record<string, string> = {};
  for (const product of options.products) {
    const created = await apiPost(admin.api, `events/${event.id}/products`, admin.headers, {
      categoryId: category.id,
      ...product,
    });
    productIds[product.name] = created.id;
  }
  return { id: event.id, productIds };
}

export async function setEventSettings(admin: PosAdmin, eventId: string, settings: Record<string, unknown>) {
  const res = await admin.api.patch(`organizations/${admin.organizationId}/events/${eventId}`, {
    headers: admin.headers,
    data: { settings },
  });
  await ensureOk(res, 'Veranstaltung einstellen');
}

/** Bereich mit einer Serie Tische (z. B. Praefix „QXA“, 6 Stueck → QXA01…QXA06). */
export async function createTables(admin: PosAdmin, area: string, prefix: string, count: number) {
  const org = admin.organizationId;
  const created = await apiPost(admin.api, `organizations/${org}/table-areas`, admin.headers, { name: area });
  await apiPost(admin.api, `organizations/${org}/tables/bulk`, admin.headers, {
    areaId: created.id,
    prefix,
    start: 1,
    count,
    padding: 2,
  });
  return created;
}

export interface PairedDevice {
  deviceId: string;
  token: string;
  storageState: BrowserContextOptions['storageState'];
}

/**
 * Kassengeraet koppeln und Einstellungen setzen; liefert den Speicherstand
 * (localStorage) eines gekoppelten Tablets.
 */
export async function pairPosDevice(
  admin: PosAdmin,
  name: string,
  settings: Record<string, unknown> = {},
): Promise<PairedDevice> {
  const init = await apiPost<{ deviceId: string; deviceToken: string; verificationCode: string }>(
    admin.api,
    'devices/init',
    {},
    { suggestedName: name, deviceType: 'pos' },
  );
  await apiPost(admin.api, 'devices/link', admin.headers, {
    code: init.verificationCode,
    organizationId: admin.organizationId,
    name,
    deviceType: 'pos',
  });
  const res = await admin.api.patch(`organizations/${admin.organizationId}/devices/${init.deviceId}`, {
    headers: admin.headers,
    data: { settings },
  });
  await ensureOk(res, 'Geraet einstellen');

  const state = {
    state: {
      deviceId: init.deviceId,
      deviceToken: init.deviceToken,
      verificationCode: null,
      organizationId: admin.organizationId,
      organizationName: null,
      deviceName: name,
      deviceClass: 'pos',
      status: 'verified',
      settings,
      table: null,
      startView: 'number',
      lastCategory: {},
    },
    version: 1,
  };
  return {
    deviceId: init.deviceId,
    token: init.deviceToken,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [
            { name: 'openeos-device', value: JSON.stringify(state) },
            { name: 'openeos-device-token', value: init.deviceToken },
          ],
        },
      ],
    },
  };
}

/**
 * Das gekoppelte Geraet in diese Seite legen (localStorage), einmal je Tab:
 * Ein Neuladen behaelt den Stand, den die Kasse inzwischen gespeichert hat.
 * (Statt `test.use({ storageState })`: dessen Wert wird ausgewertet, bevor
 * `beforeAll` das Geraet gekoppelt hat.)
 */
export async function installDevice(page: Page, device: PairedDevice) {
  const origin = (device.storageState as { origins: Array<{ localStorage: Array<{ name: string; value: string }> }> })
    .origins[0];
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem('e2e-device')) return;
    for (const entry of entries) localStorage.setItem(entry.name, entry.value);
    sessionStorage.setItem('e2e-device', '1');
  }, origin.localStorage);
}

/** Bestellung als Geraet anlegen (Testvorbereitung, z. B. eine gesendete Runde). */
export async function deviceOrder(
  admin: PosAdmin,
  device: PairedDevice,
  data: Record<string, unknown>,
): Promise<{ id: string; orderNumber: string }> {
  const res = await admin.api.post('device-api/orders', {
    headers: { 'x-device-token': device.token },
    data,
  });
  await ensureOk(res, 'Bestellung anlegen');
  return (await res.json()).data;
}

/** Bestellungen der Organisation fuer die Gegenprobe. */
export async function findOrder(admin: PosAdmin, orderNumber: string) {
  const res = await admin.api.get(`organizations/${admin.organizationId}/orders?limit=100`, { headers: admin.headers });
  await ensureOk(res, 'Bestellungen laden');
  const orders = (await res.json()).data as Array<{
    orderNumber: string;
    notes: string | null;
    fulfillmentType: string;
    tableNumber: string | null;
    paymentStatus: string;
  }>;
  return orders.find((o) => o.orderNumber === orderNumber);
}
