import { test, expect } from '../fixtures/auth.fixture';
import {
  type PairedDevice,
  type PosAdmin,
  createPosEvent,
  deviceOrder,
  pairPosDevice,
  posAdmin,
  postDeviceOrder,
} from '../fixtures/pos';

/*
 * Bestellungen in der Verwaltung: im Bestelldetail dieselben Aktionen wie
 * an der Kasse — Positionen stornieren (unbezahlt) und erstatten (bezahlt,
 * Rückgabe bar = „bar ausgezahlt“), jeweils mit Bestätigung.
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
    name: `Verwaltung Erstattung ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  eventId = event.id;
  productIds = event.productIds;
  device = await pairPosDevice(admin, 'Verwaltung 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

async function history(orderId: string) {
  const res = await admin.api.get(`organizations/${admin.organizationId}/orders/${orderId}/history`, {
    headers: admin.headers,
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as {
    total: number;
    refundedAmount: number;
    items: Array<{ productName: string; quantity: number; status: string; refundedQuantity: number }>;
    refunds: Array<{ kind: string; paymentMethod: string; status: string; amount: number; reasonCode: string }>;
  };
}

async function openOrder(page: import('@playwright/test').Page, orderNumber: string) {
  await page.goto('/orders');
  await page.getByRole('searchbox', { name: 'Nummer, Tisch oder Produkt' }).fill(orderNumber);
  await page.getByRole('row').filter({ hasText: orderNumber }).click();
  await expect(page.locator('.modal__panel').getByText(orderNumber)).toBeVisible();
}

test.describe('Orders - refund and cancel in the admin', () => {
  test('refunds one position of a paid cash order with confirmation', async ({ adminPage }) => {
    const created = await postDeviceOrder(admin, device, {
      eventId,
      notes: 'Refund2-Test',
      items: [
        { productId: productIds[PRODUCTS.schorle], quantity: 2 },
        { productId: productIds[PRODUCTS.wasser], quantity: 1 },
      ],
      payment: { paymentMethod: 'cash', amountReceived: 10 },
    });
    expect(created.ok()).toBeTruthy();
    const order = (await created.json()).data as { id: string; orderNumber: string };

    await openOrder(adminPage, order.orderNumber);
    await adminPage.getByRole('button', { name: 'Erstatten', exact: true }).click();

    const dialog = adminPage.getByRole('dialog', { name: /^Erstatten · #/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('wird als „bar ausgezahlt“ gebucht', { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: `${PRODUCTS.schorle}: mehr` }).click();
    // Ohne Grund geht es nicht weiter.
    await expect(dialog.getByRole('button', { name: 'Erstatten', exact: true })).toBeDisabled();
    await dialog.getByLabel('Grund (Pflicht)').selectOption('quality');
    await dialog.getByRole('button', { name: 'Erstatten', exact: true }).click();

    const confirm = adminPage.getByRole('dialog', { name: 'Erstattung bestätigen' });
    await expect(confirm).toContainText('3,50');
    await confirm.getByRole('button', { name: 'Jetzt erstatten' }).click();

    const done = adminPage.getByRole('dialog', { name: 'Erstattet' });
    await expect(done).toContainText('als bar ausgezahlt gebucht');
    await done.locator('.modal__foot').getByRole('button', { name: 'Schließen' }).click();

    const after = await history(order.id);
    expect(after.refundedAmount).toBe(3.5);
    expect(after.refunds).toEqual([
      expect.objectContaining({ kind: 'refund', paymentMethod: 'cash', status: 'completed', amount: -3.5, reasonCode: 'quality' }),
    ]);
    expect(after.items.find((i) => i.productName === PRODUCTS.schorle)?.refundedQuantity).toBe(1);
    // Das Detail zeigt den Gegenbeleg mit Nachdruck.
    await expect(adminPage.getByRole('button', { name: /Gegenbeleg nachdrucken/ })).toBeVisible();
  });

  test('cancels a position of an unpaid order with confirmation', async ({ adminPage }) => {
    const order = await deviceOrder(admin, device, {
      eventId,
      notes: 'Refund2-Test',
      items: [
        { productId: productIds[PRODUCTS.schorle], quantity: 1 },
        { productId: productIds[PRODUCTS.wasser], quantity: 2 },
      ],
    });

    await openOrder(adminPage, order.orderNumber);
    await adminPage.getByRole('button', { name: 'Positionen stornieren' }).click();

    const dialog = adminPage.getByRole('dialog', { name: /^Positionen stornieren · #/ });
    await dialog.getByRole('button', { name: `${PRODUCTS.wasser}: mehr` }).click();
    await dialog.getByRole('button', { name: '1 Position stornieren' }).click();

    const confirm = adminPage.getByRole('dialog', { name: 'Storno bestätigen' });
    await confirm.getByRole('button', { name: '1 Position stornieren' }).click();
    await expect(adminPage.getByText('1 Position storniert')).toBeVisible();

    const after = await history(order.id);
    expect(after.total).toBe(5.5);
    const wasser = after.items.filter((i) => i.productName === PRODUCTS.wasser);
    expect(wasser.map((i) => [i.quantity, i.status]).sort()).toEqual([
      [1, 'cancelled'],
      [1, 'pending'],
    ]);
  });
});
