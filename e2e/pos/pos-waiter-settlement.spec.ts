import { test, expect, type Page } from '@playwright/test';

import { apiPost, ensureOk } from '../fixtures/api';
import {
  createPosEvent,
  installDevice,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Kellnerabrechnung an der Kasse (bedienungen-plan.md §6, §7): „Mein
 * Zwischenstand“ für jede Bedienung, Tischübergabe aus der Liste der
 * offenen Tische und „Abrechnen“ durch die Schichtleitung mit Nummer.
 * Bildschirmfotos nur mit WAITERS_SHOTS_DIR (lokale Abnahme).
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Radler';
const SHOTS = process.env.WAITERS_SHOTS_DIR;

let admin: PosAdmin;
let till: PairedDevice;
let bookings: PairedDevice;
let eventId: string;
let productId: string;
const pins = { anna: '', lea: '' };
const ids = { anna: '', lea: '' };
/** Eindeutige Kurznamen: andere Tests legen auch „Anna“ und „Lea“ an. */
const short = { anna: '', lea: '' };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${SHOTS}/${name}-${project}.png`, fullPage: true });
}

/** Buchung als Bedienung über die API (zweites Gerät, eigene Sitzung). */
async function bookAs(pin: string, data: Record<string, unknown>) {
  const session = await admin.api.post('device-api/waiter-session', {
    headers: { 'x-device-token': bookings.token },
    data: { pin },
  });
  await ensureOk(session, 'Bedienung anmelden');
  const token = (await session.json()).data.token as string;
  const res = await admin.api.post('device-api/orders', {
    headers: { 'x-device-token': bookings.token, 'x-waiter-session': token },
    data: { eventId, ...data },
  });
  await ensureOk(res, 'Bestellung anlegen');
  return (await res.json()).data as { id: string };
}

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Abrechnung ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'tab',
    products: [{ name: PRODUCT, price: 3.5 }],
  });
  eventId = event.id;
  productId = event.productIds[PRODUCT];
  const stamp = Date.now() % 1000;
  short.anna = `Anna ${stamp}`;
  short.lea = `Lea ${stamp}`;
  const created = await apiPost<Array<{ id: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    {
      eventId,
      items: [
        { name: `Anna Berger ${stamp}`, shortName: short.anna },
        { name: `Lea Schmidt ${stamp}`, shortName: short.lea, role: 'lead' },
      ],
    },
  );
  pins.anna = created[0].pin;
  pins.lea = created[1].pin;
  ids.anna = created[0].id;
  ids.lea = created[1].id;
  till = await pairPosDevice(admin, 'Kasse Theke', { serviceMode: 'table', waiterMode: 'shared' });
  bookings = await pairPosDevice(admin, 'Kasse Zelt', { serviceMode: 'table', waiterMode: 'shared' });

  // Anna: zwei Radler bar bezahlt (Trinkgeld 1 €) und Tisch 7 noch offen.
  await bookAs(pins.anna, {
    items: [{ productId, quantity: 2 }],
    payment: { paymentMethod: 'cash', amountReceived: 10, tipAmount: 1 },
  });
  await bookAs(pins.anna, { tableNumber: '7', items: [{ productId, quantity: 1 }] });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - Kellnerabrechnung', () => {
  test('a server sees the running total and hands an open table over', async ({ page }) => {
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(pins.anna);
    await expect(pos.waiterChip()).toContainText('Anna');

    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Mein Zwischenstand' }).click();
    // Bedienung (ohne Schichtleitung): kein „Abrechnen“ im Menü.
    const sheet = page.getByRole('dialog', { name: 'Mein Zwischenstand' });
    await expect(sheet).toBeVisible();
    const figures = sheet.getByTestId('settlement-figures');
    await expect(figures).toContainText('Bar');
    await expect(figures).toContainText('8,00');
    await expect(figures).toContainText('davon Trinkgeld');
    await expect(sheet.getByTestId('settlement-cash')).toContainText('Schublade Kasse Zelt');
    await expect(sheet.getByTestId('pos-settle-open')).toContainText('Tisch 7');
    await expect(sheet).toContainText('Abrechnen macht eine Schichtleitung');
    await expect(sheet.getByTestId('pos-settle-start')).toHaveCount(0);
    await shot(page, '01-kasse-mein-zwischenstand');

    await sheet.getByTestId('pos-settle-handover').click();
    const handover = page.getByRole('dialog', { name: 'Tisch 7 übergeben' });
    await expect(handover).toBeVisible();
    await shot(page, '02-kasse-tisch-uebergeben');
    await handover.getByRole('button', { name: short.lea, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Mein Zwischenstand' })).toBeVisible();
    await expect(page.getByTestId('pos-settle-open')).toHaveCount(0);

    // Lea ist jetzt verantwortlich.
    const detail = await admin.api.get(`organizations/${admin.organizationId}/waiters/${ids.lea}/summary`, {
      headers: admin.headers,
    });
    await ensureOk(detail, 'Zwischenstand laden');
    const summary = (await detail.json()).data as { openTables: Array<{ tableNumber: string }> };
    expect(summary.openTables.map((t) => t.tableNumber)).toEqual(['7']);
  });

  test('the shift lead settles a server with a running number', async ({ page }) => {
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(pins.lea);
    await expect(pos.waiterChip()).toContainText('Lea');

    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Abrechnen' }).click();
    const sheet = page.getByRole('dialog', { name: 'Abrechnen' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: short.anna, exact: true }).click();
    await expect(sheet.getByTestId('pos-settle-period')).toContainText('Anna Berger');
    await expect(sheet.getByTestId('settlement-figures')).toContainText('8,00');
    await shot(page, '03-kasse-abrechnen-auswahl');

    const settled = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/device-api\/waiter\/settlements$/.test(new URL(r.url()).pathname),
    );
    await sheet.getByTestId('pos-settle-submit').click();
    const result = (await (await settled).json()).data as { number: number; subject: { id: string } };
    expect(result.subject.id).toBe(ids.anna);
    expect(result.number).toBeGreaterThan(0);
    const done = page.getByTestId('pos-settle-done');
    await expect(done).toContainText(`Abrechnung Nr. ${result.number}`);
    await shot(page, '04-kasse-abgerechnet');
    await page.getByTestId('pos-settle-close').click();

    // Nichts Neues: noch einmal geht nicht.
    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Abrechnen' }).click();
    const again = page.getByRole('dialog', { name: 'Abrechnen' });
    await again.getByRole('button', { name: short.anna, exact: true }).click();
    await expect(again).toContainText('Seit der letzten Abrechnung gibt es nichts abzurechnen.');
    await expect(again.getByTestId('pos-settle-submit')).toBeDisabled();
  });
});
