import { readFile } from 'fs/promises';
import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

import { apiPost, ensureOk } from '../fixtures/api';
import { createPosEvent, pairPosDevice, posAdmin, type PairedDevice, type PosAdmin } from '../fixtures/pos';

/*
 * Kellnerabrechnung in der Verwaltung (bedienungen-plan.md §7, §10):
 * Zwischenstand und Abrechnen einer Bedienung mit offenem Tisch (nur mit
 * Notiz), Liste „Abrechnungen“ mit Einzelansicht, Auskunft als CSV und
 * der Bericht „Bedienungen“. Bildschirmfotos nur mit WAITERS_SHOTS_DIR, in
 * 1440x900, 768x1024 und 390x844.
 */
test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.WAITERS_SHOTS_DIR;
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

async function shots(page: Page, name: string) {
  if (!SHOTS) return;
  const original = page.viewportSize();
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${size.name}.png`, fullPage: true });
  }
  if (original) await page.setViewportSize(original);
}

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
const ben = { id: '', name: '', pin: '' };

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Abrechnung Verwaltung ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'tab',
    products: [{ name: 'Apfelschorle', price: 2.5 }],
  });
  eventId = event.id;
  const productId = event.productIds['Apfelschorle'];
  ben.name = `Ben Krämer ${Date.now() % 1000}`;
  const [created] = await apiPost<Array<{ id: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    { eventId, items: [{ name: ben.name, shortName: 'Ben' }] },
  );
  ben.id = created.id;
  ben.pin = created.pin;
  device = await pairPosDevice(admin, 'Kasse Biergarten', { serviceMode: 'table', waiterMode: 'shared' });

  const session = await admin.api.post('device-api/waiter-session', {
    headers: { 'x-device-token': device.token },
    data: { pin: ben.pin },
  });
  await ensureOk(session, 'Bedienung anmelden');
  const token = (await session.json()).data.token as string;
  const headers = { 'x-device-token': device.token, 'x-waiter-session': token };
  for (const data of [
    { items: [{ productId, quantity: 4 }], payment: { paymentMethod: 'cash', amountReceived: 10 } },
    { items: [{ productId, quantity: 2 }], payment: { paymentMethod: 'card' } },
    { tableNumber: '3', items: [{ productId, quantity: 1 }] },
  ]) {
    await ensureOk(await admin.api.post('device-api/orders', { headers, data: { eventId, ...data } }), 'Bestellung');
  }
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('Kellnerabrechnung (Verwaltung)', () => {
  test('settles a server with an open table only with a note and lists the settlement', async ({ adminPage: page }) => {
    await page.goto('/waiters');
    const row = page.getByTestId('waiters-table').getByRole('row').filter({ hasText: ben.name });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: `${ben.name} abrechnen` }).click();

    const modal = page.getByRole('dialog', { name: `${ben.name} abrechnen` });
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('settlement-figures')).toContainText('10,00');
    await expect(modal.getByTestId('settlement-figures')).toContainText('5,00');
    await expect(modal.getByTestId('settle-open-tables')).toContainText('Tisch 3');
    await expect(modal.getByTestId('settle-submit')).toBeDisabled();
    await shots(page, '10-verwaltung-abrechnen-offener-tisch');

    await modal.getByLabel('Trotz offener Tische abrechnen (Notiz nötig)').check();
    await modal.getByLabel('Notiz', { exact: true }).fill('Tisch 3 zahlt beim Gehen an der Theke');
    await expect(modal.getByTestId('settle-submit')).toBeEnabled();
    await modal.getByTestId('settle-submit').click();

    const detail = page.getByTestId('settlement-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(ben.name);
    await expect(detail).toContainText('Trotz offener Tische abgerechnet');
    await expect(detail).toContainText('Notiz: Tisch 3 zahlt beim Gehen an der Theke');
    await shots(page, '11-verwaltung-abrechnung-detail');
    await page.getByRole('button', { name: 'Schließen' }).last().click();

    const list = page.getByTestId('waiter-settlements-table');
    await expect(list.getByRole('row').filter({ hasText: ben.name })).toContainText('trotz offener Tische');
    await page.getByTestId('waiter-settlements').scrollIntoViewIfNeeded();
    await shots(page, '12-verwaltung-abrechnungen-liste');
  });

  test('exports what is stored about a server as CSV', async ({ adminPage: page }) => {
    await page.goto('/waiters');
    const row = page.getByTestId('waiters-table').getByRole('row').filter({ hasText: ben.name });
    // Die Auskunft steht im ⋯-Menü der Zeile.
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: `Auskunft über ${ben.name} exportieren (CSV)` }).click(),
    ]);
    const text = (await readFile((await download.path())!)).toString('utf8');
    expect(download.suggestedFilename()).toMatch(/auskunft\.csv$/);
    expect(text).toContain('Bereich;Feld;Wert');
    expect(text).toContain(`Stammdaten;Name;${ben.name}`);
    expect(text).toContain('Abrechnung;Nr. ');
    expect(text).not.toContain(ben.pin);
    await expect(row.getByTestId('waiter-anonymize-due')).toContainText('wird am');
  });

  test('the report lists the server with the collected amounts', async ({ adminPage: page }) => {
    await page.goto('/reports');
    const card = page.getByTestId('reports-waiters');
    await card.scrollIntoViewIfNeeded();
    const line = card.getByRole('row').filter({ hasText: ben.name });
    await expect(line).toBeVisible();
    await expect(line).toContainText('15,00');
    await card.screenshot({ path: SHOTS ? `${SHOTS}/13-bericht-bedienungen.png` : undefined });
  });
});
