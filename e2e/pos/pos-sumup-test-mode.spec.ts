import { expect, test } from '../fixtures/test';
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
 * Testmodus: Die Kasse löst keine echten SumUp-Kartenzahlungen aus. Statt
 * echter Zahlarten bietet sie „Bar (Test)“ und „Karte (Test)“ an
 * (simuliert, kein Geld, keine Kassenlade), es gibt keinen Aufruf am
 * Lesegerät; die API lehnt Checkout und SumUp-Zahlungen mit
 * SUMUP_DISABLED_IN_TEST_MODE ab. Manuelle Kartenbuchung geht per API.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Apfelschorle';

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
let productId: string;
/** API mit Testzahlungen (test_cash/test_card)? Ältere API-Images: ohne. */
let apiHasTestPayments = false;

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
  const probe = await postDeviceOrder(admin, device, {
    eventId,
    items: [{ productId, quantity: 1 }],
    payment: { paymentMethod: 'test_card' },
  });
  apiHasTestPayments = probe.ok();
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

  test('offers „Bar (Test)“ and „Karte (Test)“ instead of real payments, no reader call', async ({ page }) => {
    const readerCalls: string[] = [];
    const drawerCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/device-api/sumup/')) readerCalls.push(request.url());
      if (request.url().includes('/device-api/cash-drawer/')) drawerCalls.push(request.url());
    });

    const pos = new POSPage(page);
    await pos.goto();
    // Ein Streifen, ein Hinweis (Telefon: Kurzfassung).
    const band = page.locator('.pos-testband');
    await expect(band).toHaveCount(1);
    await expect(band).toBeVisible();
    await expect(band.locator('.pos-testband__long:visible, .pos-testband__short:visible')).toContainText('Testmodus – Buchungen zählen nicht');
    await pos.addProduct(PRODUCT);
    await pos.checkout();

    const radios = pos.paySheet.getByRole('radio');
    await expect(pos.paySheet.getByRole('radio', { name: /Bar \(Test\)/ })).toBeEnabled();
    await expect(pos.paySheet.getByRole('radio', { name: /Karte \(Test\)/ })).toBeEnabled();
    // Keine echte Zahlart, kein „Keine Zahlart verfügbar“.
    await expect(radios.filter({ hasText: /^(Bar|Karte)/ }).filter({ hasNotText: '(Test)' })).toHaveCount(0);
    await expect(pos.paySheet.getByText('Keine Zahlart verfügbar')).toHaveCount(0);
    await expect(pos.paySheet.getByText('Testzahlung – kein echtes Geld')).toBeVisible();

    if (apiHasTestPayments) {
      await pos.paySheet.getByRole('button', { name: 'Passend', exact: true }).click();
      await pos.paySheet.getByRole('button', { name: 'Testzahlung abschließen' }).click();
      await expect(pos.doneSheet).toBeVisible();
      await expect(pos.doneSheet).toContainText('Bar (Test)');
    }
    expect(readerCalls).toEqual([]);
    expect(drawerCalls).toEqual([]);
  });

  test('the API takes test payments only for test orders', async () => {
    test.skip(!apiHasTestPayments, 'API without test payments (test_cash/test_card)');
    const order = await postDeviceOrder(admin, device, {
      eventId,
      items: [{ productId, quantity: 1 }],
      payment: { paymentMethod: 'test_cash', amountReceived: 5 },
    });
    expect(order.ok()).toBeTruthy();
    const body = await order.json();
    expect(body.data.isTest).toBe(true);
    expect(body.data.paymentStatus).toBe('paid');
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
