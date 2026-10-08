import { expect, test } from '@playwright/test';

import {
  type PairedDevice,
  type PosAdmin,
  createPosEvent,
  installDevice,
  pairPosDevice,
  posAdmin,
  postDeviceOrder,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Testmodus: Die Kasse löst keine echten SumUp-Kartenzahlungen aus. Die
 * Zahlart erscheint ausgegraut mit Hinweis, es gibt keinen Aufruf am
 * Lesegerät; die API lehnt Checkout und SumUp-Zahlungen mit
 * SUMUP_DISABLED_IN_TEST_MODE ab. Bar und manuelle Kartenbuchung gehen.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Apfelschorle';

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
let productId: string;

async function setSumup(enabled: boolean) {
  return admin.api.patch(`organizations/${admin.organizationId}/integrations/sumup`, {
    headers: admin.headers,
    data: { enabled },
  });
}

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Testmodus SumUp ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: PRODUCT, price: 3.5 }],
  });
  eventId = event.id;
  productId = event.productIds[PRODUCT];
  const testMode = await admin.api.post(`organizations/${admin.organizationId}/events/${eventId}/test`, {
    headers: admin.headers,
  });
  expect(testMode.ok()).toBeTruthy();
  expect((await setSumup(true)).ok()).toBeTruthy();
  device = await pairPosDevice(admin, 'Testmodus 1', { serviceMode: 'counter', sumupReaderId: 'rdr_e2e_test' });
});

test.afterAll(async () => {
  await setSumup(false);
  await admin.api.dispose();
});

const devicePost = (path: string, data: Record<string, unknown>) =>
  admin.api.post(`device-api/${path}`, { headers: { 'x-device-token': device.token }, data });

test.describe('POS - SumUp in test mode', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('card payment is shown disabled with a hint, no reader call, cash still works', async ({ page }) => {
    const readerCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/device-api/sumup/')) readerCalls.push(request.url());
    });

    const pos = new POSPage(page);
    await pos.goto();
    await expect(page.getByText(/^Testmodus — Bestellungen werden/)).toBeVisible();
    await pos.addProduct(PRODUCT);
    await pos.checkout();

    const card = pos.paySheet.getByRole('radio', { name: /Karte/ });
    await expect(card).toBeVisible();
    await expect(card).toBeDisabled();
    await expect(card).toContainText('Im Testmodus ohne echte Kartenzahlung');

    await pos.payCash();
    await pos.completePayment();
    expect(readerCalls).toEqual([]);
  });

  test('the API refuses SumUp checkouts and SumUp payments, manual card is booked', async () => {
    const checkout = await devicePost('sumup/checkout', { amount: 3.5 });
    expect(checkout.status()).toBe(400);
    expect((await checkout.json()).error.reason).toBe('SUMUP_DISABLED_IN_TEST_MODE');

    const sumupOrder = await postDeviceOrder(admin, device, {
      eventId,
      notes: 'Refund2-Test',
      items: [{ productId, quantity: 1 }],
      payment: { paymentMethod: 'sumup_terminal', providerTransactionId: 'e2e-tx' },
    });
    expect(sumupOrder.status()).toBe(400);
    expect((await sumupOrder.json()).error.reason).toBe('SUMUP_DISABLED_IN_TEST_MODE');

    const cardOrder = await postDeviceOrder(admin, device, {
      eventId,
      notes: 'Refund2-Test',
      items: [{ productId, quantity: 1 }],
      payment: { paymentMethod: 'card' },
    });
    expect(cardOrder.ok()).toBeTruthy();
    expect((await cardOrder.json()).data.paymentStatus).toBe('paid');
  });
});
