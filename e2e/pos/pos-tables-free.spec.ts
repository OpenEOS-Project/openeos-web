import { test, expect } from '@playwright/test';

import {
  createPosEvent,
  findOrder,
  installDevice,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Kasse mit frei eingegebener Tischnummer und offenen Rechnungen
 * (Tischmodus `free`, Kassiermodus `tab`; Spezifikation §5.3 Zeilen 5/6):
 * Senden, „Offene Tische“, Sammelzahlung über mehrere Runden, Parken je
 * Tisch, Theke und To-go.
 *
 * Seriell: alle Tests nutzen dieselbe Veranstaltung, und es ist immer nur
 * eine aktiv.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

let admin: PosAdmin;
let device: PairedDevice;

test.beforeAll(async () => {
  admin = await posAdmin();
  await createPosEvent(admin, {
    name: `Tische frei ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'tab',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  device = await pairPosDevice(admin, 'Kasse frei', { serviceMode: 'table' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - free table numbers', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('sends a round, lists the table as open and pays all rounds in one go', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    // Freie Nummer: kein Umschalter Nummer/Tische
    await expect(page.getByRole('button', { name: 'Liste', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Karte', exact: true })).toHaveCount(0);
    await pos.openTableByNumber('12');

    await pos.addProduct(PRODUCTS.schorle);
    await pos.send();
    // Die Runde steht jetzt unter „Gesendet“, der Tisch bleibt offen (F10).
    await pos.openCart();
    await expect(pos.cart.getByRole('region', { name: 'Gesendet' })).toContainText(PRODUCTS.schorle);
    await expect(pos.pill('12')).toBeVisible();
    await pos.closeCart();

    await pos.backToStart();
    await pos.expectOpenTable('12', '3,50');

    await pos.openTableRow('Tisch 12').click();
    await expect(pos.pill('12')).toBeVisible();
    await pos.addProduct(PRODUCTS.wasser);
    await pos.expectTotal('5,50');

    await pos.checkout();
    await expect(pos.paySheet).toContainText(/Zu zahlen\s*5,50\s€/);
    // Mit Rückgeld bleibt der Abschluss offen (kein automatisches Schließen).
    await pos.payCash('10,00 €');
    await pos.completePayment();
    await expect(pos.doneSheet).toContainText('2 Bestellungen');
    await expect(pos.doneSheet).toContainText(/Rückgeld 4,50\s€/);
    await pos.nextReceipt();

    // Nach dem Kassieren zurück zur Tischwahl; der Tisch ist frei.
    await expect(pos.startView).toBeVisible();
    await expect(pos.openTableRow('Tisch 12')).toHaveCount(0);
  });

  test('parks the cart per table, also across a reload', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.openTableByNumber('5');
    await pos.addProduct(PRODUCTS.schorle);
    await pos.expectCartLine(PRODUCTS.schorle, 1);
    await pos.closeCart();

    await pos.switchTable('6', { byNumber: true });
    await pos.openCart();
    await expect(pos.cart).toContainText('Warenkorb ist leer');
    await pos.closeCart();

    await pos.switchTable('5', { byNumber: true });
    await pos.expectCartLine(PRODUCTS.schorle, 1);
    await pos.closeCart();

    // Wechsel zu 6, Neuladen: Tisch 6 bleibt offen, 5 steht geparkt in der Liste.
    await pos.switchTable('6', { byNumber: true });
    await page.reload();
    await expect(pos.pill('6')).toBeVisible();
    await pos.backToStart();
    await expect(pos.openTableRow('Tisch 5')).toContainText('1 Artikel nicht gesendet');
    await pos.expectOpenTable('5', '3,50');

    // Aufräumen
    await pos.openTableRow('Tisch 5').click();
    await pos.openCart();
    await pos.clearCartButton.click();
  });

  test('sells to go without a table, marked for the kitchen', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.withoutTable('To-go');
    await pos.addProduct(PRODUCTS.wasser);
    await pos.openCart();
    await expect(pos.cart).toContainText('To-go · 1 Artikel');

    await pos.checkout();
    await pos.payCash('10,00 €');
    await pos.completePayment();
    const receiptNumber = pos.doneSheet.getByText(/#\d{8}-\d{4}/);
    await expect(receiptNumber).toBeVisible();
    const orderNumber = (await receiptNumber.textContent())!.match(/#(\d{8}-\d{4})/)![1];
    await pos.nextReceipt();
    await expect(pos.startView).toBeVisible();

    const order = await findOrder(admin, orderNumber);
    expect(order?.fulfillmentType).toBe('counter_pickup');
    expect(order?.tableNumber ?? null).toBeNull();
    expect(order?.notes).toBe('To-go');
    expect(order?.paymentStatus).toBe('paid');
  });

  test('reopens the table of an older POS version after the update', async ({ page }) => {
    // Speicherstand vor dem Umbau: Tischnummer als Text, Version 0.
    const state = JSON.parse(
      device.storageState && typeof device.storageState === 'object'
        ? device.storageState.origins[0].localStorage.find((e) => e.name === 'openeos-device')!.value
        : '{}',
    );
    delete state.state.table;
    state.state.tableNumber = '8';
    state.version = 0;
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem('e2e-migrated')) {
        localStorage.setItem('openeos-device', value);
        sessionStorage.setItem('e2e-migrated', '1');
      }
    }, JSON.stringify(state));

    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.pill('8')).toBeVisible();
    await pos.backToStart();
  });

  test('the counter context has its own pill', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.withoutTable('Theke');
    await pos.openTableSheet();
    await expect(pos.tableSheet).toContainText('Aktuell: Theke');
    await pos.tableSheet.getByRole('button', { name: 'Zur Tischübersicht' }).click();
    await expect(pos.startView).toBeVisible();
  });
});
