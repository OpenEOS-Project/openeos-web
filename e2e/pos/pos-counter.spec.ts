import { test, expect } from '@playwright/test';

import {
  createPosEvent,
  installDevice,
  pairPosDevice,
  posAdmin,
  setEventSettings,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Theken-Kasse (Gerät `counter`; Spezifikation §5.3 Zeilen 1 und 4):
 * keine Tischwahl, Barverkauf mit „Passend“ (Abschluss schließt von
 * selbst), im Modus `tab` Senden und Kassieren über „Offene Bestellungen“
 * in einer Sammelzahlung.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;

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
