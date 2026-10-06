import { test, expect } from '@playwright/test';

import {
  countOrders,
  createPosEvent,
  installDevice,
  pairPosDevice,
  posAdmin,
  postDeviceOrder,
  setEventSettings,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Theken-Kasse (Gerät `counter`; Spezifikation §5.3 Zeilen 1 und 4):
 * keine Tischwahl, Barverkauf mit „Passend“ (Abschluss schließt von
 * selbst), im Modus `tab` Senden und Kassieren über „Offene Bestellungen“
 * in einer Sammelzahlung. Im Modus `immediate` (F8) gibt es kein „Senden“,
 * und eine Bestellung entsteht erst zusammen mit ihrer Zahlung.
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
    name: `Theke ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  eventId = event.id;
  productIds = event.productIds;
  device = await pairPosDevice(admin, 'Theke 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - counter device', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('sells right away without choosing a table', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.product(PRODUCTS.wasser)).toBeVisible();
    await expect(pos.startView).toHaveCount(0);
    await expect(pos.tablePill).toHaveCount(0);
    await expect(pos.openTablesAside).toHaveCount(0);

    await pos.addProduct(PRODUCTS.wasser);
    await pos.checkout();
    await pos.payCash('Passend');
    await expect(pos.paySheet).toContainText(/Rückgeld 0,00\s€/);
    await pos.completePayment();
    // Ohne Rückgeld schließt der Abschluss nach 5 s von selbst.
    await expect(pos.doneSheet).toHaveCount(0, { timeout: 10_000 });
    await pos.openCart();
    await expect(pos.cart).toContainText('Warenkorb ist leer');
  });

  test('immediate: no Senden, the order is created together with its payment', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.addProduct(PRODUCTS.schorle);
    await pos.openCart();
    await expect(pos.checkoutButton).toBeVisible();
    await expect(pos.sendButton).toHaveCount(0);

    const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && /\/device-api\/(orders|payments)/.test(path)) {
        writes.push({ path, body: request.postDataJSON() });
      }
    });
    const before = await countOrders(admin, eventId);

    await pos.checkout();
    // Das Kassieren-Blatt ist offen, bezahlt ist noch nichts: keine Bestellung.
    expect(await countOrders(admin, eventId)).toBe(before);
    await pos.payCash('Passend');
    await pos.completePayment();

    // Ein einziger Aufruf: Bestellung mit Zahlung, keine Zahlung hinterher.
    expect(writes.map((w) => w.path.replace(/^\/api/, ''))).toEqual(['/device-api/orders']);
    expect(writes[0].body.payment).toMatchObject({ paymentMethod: 'cash', amountReceived: 3.5 });
    expect(await countOrders(admin, eventId)).toBe(before + 1);
    const res = await admin.api.get(`organizations/${admin.organizationId}/orders?eventId=${eventId}&limit=100`, {
      headers: admin.headers,
    });
    const orders = (await res.json()).data as Array<{ paymentStatus: string }>;
    expect(orders.map((o) => o.paymentStatus)).not.toContain('unpaid');
  });

  test('immediate: closing the pay sheet or a refused payment leaves no order behind', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.addProduct(PRODUCTS.wasser);
    const before = await countOrders(admin, eventId);

    // Abbrechen
    await pos.checkout();
    await pos.paySheet.getByRole('button', { name: 'Zurück', exact: true }).click();
    await expect(pos.paySheet).toHaveCount(0);
    expect(await countOrders(admin, eventId)).toBe(before);

    // Die API lehnt die Zahlung ab (zu wenig gegeben): Bestellung und
    // Zahlung gehören zusammen — es bleibt keine Bestellung, der
    // Warenkorb bleibt stehen.
    await page.route(/\/device-api\/orders$/, async (route) => {
      const body = route.request().postDataJSON();
      body.payment.amountReceived = 0.5;
      await route.continue({ postData: JSON.stringify(body) });
    });
    await pos.checkout();
    await pos.payCash('Passend');
    await pos.paySheet.getByRole('button', { name: 'Zahlung abschließen' }).click();
    await expect(page.getByText(/Betrag stimmt nicht/)).toBeVisible();
    await expect(pos.doneSheet).toHaveCount(0);
    expect(await countOrders(admin, eventId)).toBe(before);
    await page.unroute(/\/device-api\/orders$/);

    await pos.paySheet.getByRole('button', { name: 'Zurück', exact: true }).click();
    await pos.expectCartLine(PRODUCTS.wasser, 1);
    await pos.clearCartButton.click();
  });

  test('immediate: the device API refuses an unpaid order', async () => {
    const res = await postDeviceOrder(admin, device, {
      eventId,
      source: 'pos',
      items: [{ productId: productIds[PRODUCTS.wasser], quantity: 1 }],
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.reason).toBe('ORDER_PAYMENT_REQUIRED');
  });

  test('sends to the kitchen and checks out open orders in one batch', async ({ page }) => {
    await setEventSettings(admin, eventId, { orderingMode: 'tab' });
    const pos = new POSPage(page);
    await pos.goto();

    await pos.addProduct(PRODUCTS.schorle);
    await pos.send();
    await pos.closeCart();
    await pos.addProduct(PRODUCTS.wasser);
    await pos.send();
    await pos.closeCart();

    await pos.openMenu('Offene Bestellungen');
    const sheet = page.getByRole('dialog', { name: 'Offene Rechnungen' });
    await expect(sheet).toContainText('2 Bestellungen');
    await sheet.getByRole('button', { name: /^Kassieren · 5,50\s€$/ }).click();

    const pay = page.getByRole('dialog', { name: 'Offene Rechnungen' }).last();
    await pay.getByRole('radio', { name: 'Bar' }).click();
    await pay.getByRole('button', { name: '10,00 €', exact: true }).click();
    await pay.getByRole('button', { name: 'Zahlung abschließen' }).click();
    await expect(pos.doneSheet).toContainText(/Rückgeld 4,50\s€/);
    await pos.nextReceipt();

    await pos.openMenu('Offene Bestellungen');
    await expect(page.getByRole('dialog', { name: 'Offene Rechnungen' })).toContainText('Keine offenen Rechnungen');
  });
});
