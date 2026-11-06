import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import {
  type PairedDevice,
  type PosAdmin,
  createPosEvent,
  pairPosDevice,
  posAdmin,
  postDeviceOrder,
} from '../fixtures/pos';

/*
 * CSV-Export der Bestellliste: Symbol-Knopf mit Sprechblase, Menü mit zwei
 * Varianten (je Bestellung, je Position), Download der gefilterten
 * Bestellungen im Excel-Format (BOM, Semikolon, Dezimalkomma). Mitglieder
 * ohne Recht „Bestellungen“ sehen den Knopf nicht.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
let eventName: string;
const orderNumbers: string[] = [];

test.beforeAll(async () => {
  admin = await posAdmin();
  eventName = `CSV-Export ${Date.now()}`;
  const event = await createPosEvent(admin, {
    name: eventName,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  eventId = event.id;
  device = await pairPosDevice(admin, 'Export 1', { serviceMode: 'counter' });
  for (const quantity of [2, 1]) {
    const res = await postDeviceOrder(admin, device, {
      eventId,
      items: [
        { productId: event.productIds[PRODUCTS.schorle], quantity },
        { productId: event.productIds[PRODUCTS.wasser], quantity: 1 },
      ],
      payment: { paymentMethod: 'cash', amountReceived: 20 },
    });
    expect(res.ok()).toBeTruthy();
    orderNumbers.push(((await res.json()).data as { orderNumber: string }).orderNumber);
  }
});

test.afterAll(async () => {
  await admin.api.dispose();
});

/** Liste auf die Test-Veranstaltung filtern und eine Exportvariante laden. */
async function exportCsv(page: Page, variant: RegExp) {
  await page.goto('/orders');
  await page.getByRole('combobox').filter({ hasText: 'Alle Veranstaltungen' }).selectOption({ label: eventName });
  await expect(page.getByRole('row').filter({ hasText: orderNumbers[0] })).toBeVisible();

  const trigger = page.getByRole('button', { name: 'Als CSV exportieren' });
  await trigger.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: 'Als CSV exportieren' })).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('menu').getByText('2 gefilterte Bestellungen als CSV')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: variant }).click(),
  ]);
  const bytes = await readFile((await download.path())!);
  return { filename: download.suggestedFilename(), bytes, text: bytes.toString('utf8') };
}

test.describe('Orders - CSV export', () => {
  test('one row per order: BOM, semicolons, decimal comma, only the filtered event', async ({ adminPage }) => {
    const { filename, bytes, text } = await exportCsv(adminPage, /^Bestellungen/);
    expect(filename).toMatch(/^bestellungen_\d{4}-\d{2}-\d{2}\.csv$/);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const lines = text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Bestellnummer;Tagesnummer;Datum;Uhrzeit;Veranstaltung;Status;/);
    // Aelteste zuerst; 2x 3,50 + 1x 2,00 = 9,00, 1x 3,50 + 1x 2,00 = 5,50.
    expect(lines[1]).toContain(`${orderNumbers[0]};`);
    expect(lines[1]).toContain(`;${eventName};Abgeschlossen;Kasse;`);
    expect(lines[1]).toContain(';Bar;');
    expect(lines[1]).toContain(';9,00;');
    expect(lines[2]).toContain(`${orderNumbers[1]};`);
    expect(lines[2]).toContain(';5,50;');
    expect(lines[1]).toMatch(/;\d{2}\.\d{2}\.\d{4};\d{2}:\d{2}:\d{2};/);
  });

  test('one row per position with unit price and VAT rate', async ({ adminPage }) => {
    const { filename, text } = await exportCsv(adminPage, /^Positionen/);
    expect(filename).toMatch(/^bestellpositionen_/);
    const lines = text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain(';Produkt;Kategorie;Variante;Menge;Erstattete Menge;Einzelpreis;MwSt-Satz (%);');
    expect(lines.find((l) => l.startsWith(`${orderNumbers[0]};`) && l.includes(`;${PRODUCTS.schorle};`))).toContain(
      ';2;0;3,50;',
    );
  });

  test('members without the orders permission see no export', async ({ memberPage }) => {
    await memberPage.goto('/orders');
    await expect(memberPage.getByRole('searchbox', { name: 'Nummer, Tisch oder Produkt' })).toBeVisible();
    await expect(memberPage.getByRole('button', { name: 'Als CSV exportieren' })).toHaveCount(0);
  });
});
