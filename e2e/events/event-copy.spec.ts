import { readFile } from 'node:fs/promises';

import { test, expect } from '../fixtures/auth.fixture';
import { apiPost } from '../fixtures/api';
import { createPosEvent, posAdmin, type PosAdmin } from '../fixtures/pos';
import { EventsPage } from '../pages/events.page';

/*
 * Übernahme aus einer anderen Veranstaltung: beim Anlegen, auf der
 * Produktseite, als CSV und als ganze Kopie. Läuft gegen die echte API;
 * kennt das API-Image die Endpunkte noch nicht (die Oberfläche ist vor der
 * API dran), werden die Tests übersprungen statt falsch zu scheitern.
 */
test.describe.configure({ mode: 'serial' });

interface ProductRow {
  name: string;
  productionStationId: string | null;
}

const stamp = Date.now();
const sourceName = `Vorlage ${stamp}`;
let admin: PosAdmin;
let sourceId: string;

const get = async <T>(path: string): Promise<T> =>
  (await (await admin.api.get(path, { headers: admin.headers })).json()).data as T;

const eventByName = async (name: string) =>
  (await get<Array<{ id: string; name: string; copiedFromEventId: string | null }>>(
    `organizations/${admin.organizationId}/events?limit=500`,
  )).find((event) => event.name === name)!;

test.beforeAll(async () => {
  admin = await posAdmin();
  const source = await createPosEvent(admin, {
    name: sourceName,
    tables: { mode: 'none' },
    orderingMode: 'tab',
    products: [
      { name: 'Apfelschorle', price: 3.5 },
      { name: 'Wasser', price: 2 },
    ],
  });
  sourceId = source.id;
  const probe = await admin.api.get(`events/${sourceId}/products/export`, { headers: admin.headers });
  test.skip(
    !(probe.headers()['content-type'] ?? '').startsWith('text/csv'),
    'API image does not know the event copy endpoints yet',
  );
  const station = await apiPost(admin.api, `events/${sourceId}/production-stations`, admin.headers, { name: 'Theke' });
  const res = await admin.api.patch(`events/${sourceId}/products/${source.productIds.Wasser}`, {
    headers: admin.headers,
    data: { productionStationId: station.id },
  });
  expect(res.ok()).toBeTruthy();
  await apiPost(admin.api, `organizations/${admin.organizationId}/waiters`, admin.headers, {
    name: `Anna ${stamp}`,
    eventId: sourceId,
  });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test('create: takes the catalog over from the chosen event', async ({ adminPage }) => {
  const eventsPage = new EventsPage(adminPage);
  await eventsPage.goto();
  await eventsPage.createButton.click();
  const line = eventsPage.modal.getByTestId('event-copy-source');
  const select = eventsPage.modal.getByLabel('Übernehmen aus');
  // Vorausgewählt ist die Veranstaltung mit dem jüngsten Beginn.
  await expect(select).not.toHaveValue('');
  await select.selectOption('');
  await expect(line).toContainText('ohne Karte');
  await select.selectOption(sourceId);
  await expect(line).toContainText(`Karte, Kategorien und Standorte werden aus „${sourceName}“ übernommen.`);
  await eventsPage.modal.getByRole('button', { name: 'Abbrechen' }).click();

  const name = `Mit Karte ${stamp}`;
  await eventsPage.createEvent({ name, startDate: '2026-03-01', copyFrom: sourceId });
  await expect(adminPage.getByText(/übernommen: 2 Produkte, 1 Kategorien, 1 Standorte/)).toBeVisible();

  const created = await eventByName(name);
  expect(created.copiedFromEventId).toBe(sourceId);
  const products = await get<ProductRow[]>(`events/${created.id}/products?limit=500`);
  expect(products.map((p) => p.name).sort()).toEqual(['Apfelschorle', 'Wasser']);
  expect(products.find((p) => p.name === 'Wasser')!.productionStationId).toBeTruthy();
});

test('products page: merges categories, skips existing products and reports it', async ({ adminPage: page }) => {
  await createPosEvent(admin, {
    name: `Ziel ${stamp}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: 'apfelschorle', price: 4 }],
  });
  await page.goto('/products');
  await page.getByRole('button', { name: 'Aus Veranstaltung übernehmen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Veranstaltung', { exact: true }).selectOption(sourceId);
  const tree = dialog.getByTestId('copy-tree');
  await expect(tree.getByRole('checkbox', { name: /Wasser/ })).toBeChecked();

  // Teilauswahl: die Kategorie zeigt den Zwischenzustand, nichts sperrt den Knopf.
  await tree.locator('label').filter({ hasText: 'Wasser' }).click();
  await expect(tree.getByRole('checkbox', { name: /Getränke/ })).toHaveJSProperty('indeterminate', true);
  await tree.locator('label').filter({ hasText: 'Apfelschorle' }).click();
  await expect(dialog.getByRole('button', { name: /übernehmen/ })).toBeDisabled();
  await tree.getByText('Alles auswählen').click();

  await dialog.getByRole('button', { name: '2 Produkte übernehmen' }).click();
  const result = dialog.getByTestId('copy-result');
  await expect(result).toContainText('1 übernommen, 1 übersprungen (schon vorhanden)');
  await expect(result).toContainText('Kategorien: 0 neu, 1 zusammengeführt');
  await expect(result).toContainText('Standorte: 1 neu');
  await dialog.locator('.modal__foot').getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByText('Wasser', { exact: true })).toBeVisible();
});

test('CSV: the export can be imported again unchanged', async ({ adminPage: page }) => {
  await page.goto('/products');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Als CSV exportieren' }).click(),
  ]);
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString('utf8')).toMatch(/^﻿category;name;description;price;taxRate;/);

  await page.getByRole('button', { name: 'Importieren' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'produkte.csv', mimeType: 'text/csv', buffer: bytes });
  await dialog.getByRole('button', { name: 'Vorschau' }).click();
  // Alles schon da, nichts fehlerhaft.
  await expect(dialog.getByRole('cell', { name: 'Überspringen' })).toHaveCount(2);
  await expect(dialog.getByRole('cell', { name: 'Fehler' })).toHaveCount(0);
});

test('duplicate: new event with settings and new PINs', async ({ adminPage }) => {
  const eventsPage = new EventsPage(adminPage);
  await eventsPage.goto();
  await eventsPage.rowAction(sourceName, 'Veranstaltung duplizieren');
  const dialog = eventsPage.modal;
  await expect(dialog.getByRole('heading', { name: 'Veranstaltung duplizieren' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue(`${sourceName} (Kopie)`);
  const name = `Kopie ${stamp}`;
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
  await dialog.getByLabel('Startdatum').fill('2027-05-01');
  await expect(dialog.getByLabel('Enddatum')).toHaveValue('2027-05-01');
  await dialog.getByRole('button', { name: 'Duplizieren', exact: true }).click();

  const pins = adminPage.getByTestId('pin-reveal-list');
  await expect(pins).toContainText(`Anna ${stamp}`);
  await expect(pins.locator('.waiters-reveal__pin')).toHaveText(/^\d{4,6}$/);
  await adminPage.getByRole('button', { name: 'Fertig' }).click();
  await expect(eventsPage.row(name)).toBeVisible();
  await eventsPage.expectStatus(name, 'Inaktiv');

  const copy = await eventByName(name);
  const event = await get<{ settings: { orderingMode?: string } }>(
    `organizations/${admin.organizationId}/events/${copy.id}`,
  );
  expect(event.settings.orderingMode).toBe('tab');
  expect((await get<ProductRow[]>(`events/${copy.id}/products?limit=500`)).length).toBe(2);
});
