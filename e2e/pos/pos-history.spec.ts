import { expect, test } from '@playwright/test';

import {
  type PairedDevice,
  type PosAdmin,
  createPosEvent,
  deviceOrder,
  installDevice,
  pairPosDevice,
  posAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Bestellverlauf der Kasse: ein Status je Bestellung, Detail, Storno
 * einzelner Positionen (Küche hat noch nicht begonnen) und Erstattung mit
 * Gegenbeleg. Bezahlte Bestellungen lassen sich nur mit Erstattung
 * stornieren.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
let productIds: Record<string, string>;

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Verlauf ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  eventId = event.id;
  productIds = event.productIds;
  device = await pairPosDevice(admin, 'Verlauf 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

const deviceGet = (path: string) =>
  admin.api.get(`device-api/${path}`, { headers: { 'x-device-token': device.token } });
const devicePost = (path: string, data: Record<string, unknown>) =>
  admin.api.post(`device-api/${path}`, { headers: { 'x-device-token': device.token }, data });

test.describe('POS - order history', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('cancels a position the kitchen has not started, from the detail sheet', async ({
    page,
  }) => {
    const order = await deviceOrder(admin, device, {
      eventId,
      notes: 'Verlauf-Test',
      items: [
        { productId: productIds[PRODUCTS.schorle], quantity: 2 },
        { productId: productIds[PRODUCTS.wasser], quantity: 1 },
      ],
    });

    const pos = new POSPage(page);
    await pos.goto();
    await pos.openMenu('Bestellverlauf');
    const history = page.getByRole('dialog', { name: 'Bestellverlauf' });
    await expect(history.getByText('Offen – nicht bezahlt').first()).toBeVisible();
    await history
      .getByRole('button', { name: /Offen – nicht bezahlt/ })
      .first()
      .click();
    await expect(history.locator('.pos-oh-row')).toHaveCount(1);
    await history.locator('.pos-oh-row').first().click();

    const detail = page.getByRole('dialog', { name: /Bestellung #/ });
    await expect(detail.getByText('Apfelschorle')).toBeVisible();
    await detail.getByRole('button', { name: 'Positionen stornieren' }).click();

    const cancel = page.getByRole('dialog', { name: /Positionen stornieren/ });
    await cancel.locator('.oe-stepper').first().getByRole('button', { name: 'Mehr' }).click();
    await cancel.getByRole('button', { name: '1 Position stornieren' }).click();
    await expect(page.getByText('1 Position storniert')).toBeVisible();

    const res = await deviceGet(`orders/${order.id}`);
    const body = (await res.json()).data as {
      total: number;
      items: Array<{ productName: string; quantity: number; status: string }>;
    };
    const schorle = body.items.filter((i) => i.productName === PRODUCTS.schorle);
    expect(schorle.map((i) => [i.quantity, i.status]).sort()).toEqual([
      [1, 'cancelled'],
      [1, 'pending'],
    ]);
    expect(body.total).toBe(5.5);
  });

  test('a paid order is only cancelled with a refund (counter-receipt)', async () => {
    const created = await devicePost('orders', {
      eventId,
      notes: 'Verlauf-Test',
      items: [{ productId: productIds[PRODUCTS.wasser], quantity: 2 }],
      payment: { paymentMethod: 'cash', amountReceived: 5 },
    });
    expect(created.ok()).toBeTruthy();
    const orderId = (await created.json()).data.id as string;

    const cancel = await devicePost(`orders/${orderId}/cancel`, {});
    expect(cancel.status()).toBe(400);
    expect((await cancel.json()).error.reason).toBe('ORDER_PAID_REFUND_REQUIRED');

    const refund = await devicePost(`orders/${orderId}/refunds`, {
      mode: 'full',
      cancelItems: true,
      reasonCode: 'wrong_order',
    });
    expect(refund.ok()).toBeTruthy();
    const data = (await refund.json()).data as {
      refunds: Array<{ amount: number; paymentMethod: string; status: string }>;
      order: { displayStatus: string; refunds: Array<{ refundNumber: string; kind: string }> };
    };
    expect(data.refunds).toEqual([expect.objectContaining({ amount: -4, paymentMethod: 'cash' })]);
    expect(data.order.displayStatus).toBe('cancelled');
    expect(data.order.refunds[0].kind).toBe('cancellation');
  });

  test('lists with one status, counts and server-side search', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.openMenu('Bestellverlauf');
    const history = page.getByRole('dialog', { name: 'Bestellverlauf' });
    await expect(history.getByRole('button', { name: /^Storniert/ })).toContainText('1');
    await history.getByRole('searchbox', { name: 'Suche' }).fill('Apfelschorle');
    await expect(history.locator('.pos-oh-row')).toHaveCount(1);
    await expect(history.getByText('Heute')).toBeVisible();
  });
});
