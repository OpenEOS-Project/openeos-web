import { test, expect, type Page } from '@playwright/test';

import { apiPost, ensureOk } from '../fixtures/api';
import { createPosEvent, installDevice, pairPosDevice, posAdmin, type PairedDevice, type PosAdmin } from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Live-Kassensturz an der Kasse (Schichtleitung) und Auszahlung von
 * Kartentrinkgeld an angestellte Bedienungen (Steuerberater 2026-11-10,
 * Fragen 5 und 7). Bildschirmfotos nur mit LIVE_AUDIT_SHOTS_DIR.
 */
test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.LIVE_AUDIT_SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const project = test.info().project.name;
  const suffix = project === 'pos-phone' ? '-mobil' : project === 'pos-tablet' ? '-tablet' : '';
  // Abnahme in 1440x900, 768x1024 und 390x844.
  const size = project === 'pos-phone' ? { width: 390, height: 844 } : project === 'pos-tablet' ? { width: 768, height: 1024 } : { width: 1440, height: 900 };
  const original = page.viewportSize();
  await page.setViewportSize(size);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/${name}${suffix}.png` });
  if (original) await page.setViewportSize(original);
}

let admin: PosAdmin;
let till: PairedDevice;
let bookings: PairedDevice;
let eventId = '';
let productId = '';

/** Buchung als Bedienung über die API (zweites Gerät, eigene Sitzung). */
async function book(pin: string, payment: Record<string, unknown>) {
  const session = await admin.api.post('device-api/waiter-session', {
    headers: { 'x-device-token': bookings.token },
    data: { pin },
  });
  await ensureOk(session, 'Bedienung anmelden');
  const token = (await session.json()).data.token as string;
  await ensureOk(
    await admin.api.post('device-api/orders', {
      headers: { 'x-device-token': bookings.token, 'x-waiter-session': token },
      data: { eventId, items: [{ productId, quantity: 2 }], payment },
    }),
    'Bestellung',
  );
}
const stamp = Date.now() % 1000;
const people = {
  max: { id: '', pin: '', name: `Max Braun ${stamp}`, short: `Max ${stamp}` },
  paul: { id: '', pin: '', name: `Paul Graf ${stamp}`, short: `Paul ${stamp}` },
  lea: { id: '', pin: '', name: `Lea Vogt ${stamp}`, short: `Lea ${stamp}` },
};

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Kassensturz ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'tab',
    products: [{ name: 'Radler', price: 3.5 }],
  });
  eventId = event.id;
  productId = event.productIds['Radler'];
  const created = await apiPost<Array<{ id: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    {
      eventId,
      items: [
        { name: people.max.name, shortName: people.max.short },
        { name: people.paul.name, shortName: people.paul.short },
        { name: people.lea.name, shortName: people.lea.short, role: 'lead' },
      ],
    },
  );
  [people.max.id, people.max.pin] = [created[0].id, created[0].pin];
  [people.paul.id, people.paul.pin] = [created[1].id, created[1].pin];
  [people.lea.id, people.lea.pin] = [created[2].id, created[2].pin];
  await ensureOk(
    await admin.api.patch(`organizations/${admin.organizationId}/waiters/${people.max.id}`, {
      headers: admin.headers,
      data: { isEmployee: true },
    }),
    'Arbeitnehmer setzen',
  );
  till = await pairPosDevice(admin, 'Kasse Theke', { serviceMode: 'table', waiterMode: 'shared' });
  bookings = await pairPosDevice(admin, 'Kasse Zelt', { serviceMode: 'table', waiterMode: 'shared' });

  await book(people.max.pin, { paymentMethod: 'cash', amountReceived: 10, tipAmount: 1 });
  await book(people.max.pin, { paymentMethod: 'card', tipAmount: 2.5 });
  await book(people.paul.pin, { paymentMethod: 'card', tipAmount: 1.5 });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - Live-Kassensturz', () => {
  test('a server without the lead role has no live cash audit', async ({ page }) => {
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(people.paul.pin);
    await pos.waiterChip().click();
    await expect(page.getByRole('menuitem', { name: 'Mein Zwischenstand' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Live-Kassensturz' })).toHaveCount(0);
  });

  test('the shift lead sees the expected cash and pays out card tips of an employee', async ({ page }) => {
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(people.lea.pin);
    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Live-Kassensturz' }).click();

    const sheet = page.getByRole('dialog', { name: 'Live-Kassensturz' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Für eine Kassen-Nachschau');
    const list = sheet.getByTestId('pos-live-audit');
    await expect(list).toContainText(people.max.name);
    await expect(list).toContainText(people.paul.name);
    await expect(list).toContainText('Kasse Zelt');
    // Nur Max (angestellt) bekommt das Kartentrinkgeld ausgezahlt.
    const payouts = list.getByTestId('pos-live-audit-payout');
    await expect(payouts).toHaveCount(1);
    await expect(payouts).toContainText('2,50');
    await shot(page, '94-kasse-live-kassensturz');

    await payouts.click();
    await shot(page, '95-kasse-kartentrinkgeld-bestaetigen');
    await list.getByTestId('pos-live-audit-payout-confirm').click();
    await expect(page.getByText(new RegExp(`2,50\\s€ Kartentrinkgeld an ${people.max.name} ausgezahlt`))).toBeVisible();
    await expect(list.getByTestId('pos-live-audit-payout')).toHaveCount(0);
  });

  test('the shift lead settles an employee and pays out the card tips with it', async ({ page }) => {
    await book(people.max.pin, { paymentMethod: 'card', tipAmount: 1.2 });
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(people.lea.pin);
    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Abrechnen' }).click();
    const sheet = page.getByRole('dialog', { name: 'Abrechnen' });
    await sheet.getByRole('button', { name: people.max.short, exact: true }).click();
    const tips = sheet.getByTestId('pos-settle-tip-payout');
    await expect(tips).toContainText(/Offenes Kartentrinkgeld \(1,20\s€\) bar auszahlen/);
    await tips.getByRole('checkbox').check();
    await shot(page, '96-kasse-abrechnen-kartentrinkgeld');
    await sheet.getByTestId('pos-settle-submit').click();
    const done = page.getByTestId('pos-settle-done');
    await expect(done).toBeVisible();
    await expect(done.getByTestId('pos-settle-tip-payout-done')).toContainText(/1,20\s€ Kartentrinkgeld an/);
    await shot(page, '97-kasse-abgerechnet-mit-auszahlung');
  });

  test('a server without the lead role cannot pay out tips at the till', async ({ page }) => {
    await installDevice(page, till);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(people.max.pin);
    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Mein Zwischenstand' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mein Zwischenstand' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('pos-settle-tip-payout')).toHaveCount(0);
  });
});
