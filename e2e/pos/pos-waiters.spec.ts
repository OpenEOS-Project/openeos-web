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
import { TEST_ORG } from '../fixtures/test-data';

/*
 * Bedienungen an der gemeinsamen Kasse (bedienungen-plan.md §6):
 * „Wer bedient?“ per PIN, Chip mit Kurzname, Sperren mit geparktem
 * Warenkorb je Bedienung, Zuordnung der Bestellung, Pflicht der Sitzung
 * und Sperre nach Fehlversuchen. Bildschirmfotos nur mit
 * WAITERS_SHOTS_DIR (lokale Abnahme).
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Radler';
const SHOTS = process.env.WAITERS_SHOTS_DIR;

let admin: PosAdmin;
let device: PairedDevice;
let lockDevice: PairedDevice;
let eventId: string;
let productId: string;
const pins = { anna: '', lea: '' };
const ids = { anna: '', lea: '' };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${SHOTS}/${name}-${project}.png`, fullPage: true });
}

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Bedienungen ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: PRODUCT, price: 3.5 }],
  });
  eventId = event.id;
  productId = event.productIds[PRODUCT];
  const created = await apiPost<Array<{ id: string; name: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    {
      eventId,
      items: [
        { name: `Anna Berger ${Date.now() % 1000}`, shortName: 'Anna' },
        { name: `Lea Schmidt ${Date.now() % 1000}`, shortName: 'Lea', role: 'lead' },
      ],
    },
  );
  pins.anna = created[0].pin;
  pins.lea = created[1].pin;
  ids.anna = created[0].id;
  ids.lea = created[1].id;
  device = await pairPosDevice(admin, 'Gemeinsame Kasse', { serviceMode: 'counter', waiterMode: 'shared' });
  lockDevice = await pairPosDevice(admin, 'Kasse Sperre', { serviceMode: 'counter', waiterMode: 'shared' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - Bedienungen (gemeinsame Kasse)', () => {
  test('asks „Wer bedient?“, signs in by PIN and books the sale for the server', async ({ page }) => {
    await installDevice(page, device);
    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.pinScreen.getByRole('heading', { name: 'Wer bedient?' })).toBeVisible();
    await shot(page, '01-pos-wer-bedient');

    await pos.enterPin('0001');
    await expect(pos.pinScreen.getByRole('alert')).toContainText('Ungültige PIN');

    await pos.enterPin(pins.anna);
    await expect(pos.waiterChip()).toContainText('Anna');
    await expect(pos.product(PRODUCT)).toBeVisible();
    // Gerät und Verein stehen neben dem Chip im Kopf — auch auf dem Telefon.
    const ctx = page.locator('.pos-head__ctx');
    await expect(ctx).toBeVisible();
    await expect(ctx).toContainText('Gemeinsame Kasse');
    await expect(ctx).toContainText(TEST_ORG.name);
    await shot(page, '02-pos-angemeldet-chip');

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/device-api\/orders$/.test(new URL(r.url()).pathname),
    );
    await pos.addProduct(PRODUCT);
    await pos.checkout();
    await pos.payCash('Passend');
    await pos.completePayment();
    const order = (await (await created).json()).data as { id: string; createdByWaiterId: string; waiterId: string };
    expect(order.createdByWaiterId).toBe(ids.anna);
    expect(order.waiterId).toBe(ids.anna);

    // Verlauf zeigt die Bedienung bei Bestellung und Zahlung.
    const detail = await admin.api.get(`device-api/orders/${order.id}`, {
      headers: { 'x-device-token': device.token },
    });
    await ensureOk(detail, 'Bestellung laden');
    const data = (await detail.json()).data as {
      waiter: { id: string } | null;
      payments: Array<{ waiter: { id: string } | null }>;
    };
    expect(data.waiter?.id).toBe(ids.anna);
    expect(data.payments[0]?.waiter?.id).toBe(ids.anna);
  });

  test('locking keeps the cart for the server; the next server starts empty', async ({ page }) => {
    await installDevice(page, device);
    const pos = new POSPage(page);
    await pos.goto();
    await pos.enterPin(pins.anna);
    await pos.addProduct(PRODUCT);
    await pos.addProduct(PRODUCT);
    await pos.expectCartLine(PRODUCT, 2);
    await pos.closeCart();

    await pos.lock();
    await expect(pos.pinScreen).toContainText(/Der Warenkorb wird für .* gemerkt/);
    await shot(page, '03-pos-gesperrt-warenkorb-gemerkt');

    await pos.enterPin(pins.lea);
    await expect(pos.waiterChip()).toContainText('Lea');
    await pos.openCart();
    await expect(pos.cart).toContainText('Warenkorb ist leer');
    await pos.closeCart();

    await pos.waiterChip().click();
    await page.getByRole('menuitem', { name: 'Wechseln' }).click();
    await pos.enterPin(pins.anna);
    await pos.expectCartLine(PRODUCT, 2);
  });

  test('the API refuses bookings without a server session on a shared till', async () => {
    const res = await admin.api.post('device-api/orders', {
      headers: { 'x-device-token': device.token },
      data: { eventId, items: [{ productId, quantity: 1 }] },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error?.reason).toBe('WAITER_SESSION_REQUIRED');
  });

  test('locks PIN entry after five wrong PINs', async ({ page }) => {
    await installDevice(page, lockDevice);
    const pos = new POSPage(page);
    await pos.goto();
    for (const pin of ['5020', '5021', '5022', '5023', '5024']) {
      await pos.enterPin(pin);
      await expect(pos.pinScreen.getByRole('alert')).toBeVisible();
    }
    await pos.enterPin('5025');
    await expect(pos.pinScreen.getByRole('alert')).toContainText(/gesperrt/);
    await shot(page, '04-pos-pin-gesperrt');
  });
});
