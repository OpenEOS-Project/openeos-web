import { test, expect, type BrowserContextOptions } from '@playwright/test';

import { apiLogin, apiPost, newApiContext } from '../fixtures/api';
import { loginAs } from '../fixtures/auth.fixture';
import { TEST_ADMIN } from '../fixtures/test-data';
import { POSPage } from '../pages/pos.page';

/*
 * Die Kasse von der Kopplung bis zur bezahlten Bestellung.
 *
 * Frueher testete diese Datei eine Seite /pos im Dashboard, die es nicht
 * mehr gibt — die Kasse ist heute ein gekoppeltes Geraet unter
 * /device/pos. Fast jeder Test stand zudem hinter `if (isVisible())` und
 * bestand damit auch, wenn nichts davon zu sehen war.
 *
 * Seriell: die Tests bauen aufeinander auf (erst koppeln, dann verkaufen).
 */
test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const EVENT_NAME = `Kassentest ${stamp}`;
const CATEGORY = 'Getränke';
const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

/** Zugangsdaten des gekoppelten Geraets (Geraete-Token im localStorage). */
let deviceState: BrowserContextOptions['storageState'];

test.beforeAll(async () => {
  // Stammdaten ueber die API: Veranstaltung, Kategorie und Produkte
  // anzulegen ist nicht Gegenstand dieser Tests. Die Veranstaltung wird
  // aktiviert — die Kasse verkauft nur fuer die aktive.
  const api = await newApiContext();
  try {
    const admin = await apiLogin(api, TEST_ADMIN.email, TEST_ADMIN.password);
    const org = admin.organizationId;
    const event = await apiPost(api, `organizations/${org}/events`, admin.headers, {
      name: EVENT_NAME,
      startDate: '2026-03-01',
    });
    await apiPost(api, `organizations/${org}/events/${event.id}/activate`, admin.headers);
    const category = await apiPost(api, `events/${event.id}/categories`, admin.headers, { name: CATEGORY });
    await apiPost(api, `events/${event.id}/products`, admin.headers, {
      categoryId: category.id,
      name: PRODUCTS.schorle,
      price: 3.5,
    });
    await apiPost(api, `events/${event.id}/products`, admin.headers, {
      categoryId: category.id,
      name: PRODUCTS.wasser,
      price: 2,
    });
  } finally {
    await api.dispose();
  }
});

test.describe('POS - Point of Sale', () => {
  test('an unpaired device is sent to registration', async ({ page }) => {
    await page.goto('/device/pos');
    await expect(page).toHaveURL(/\/device\/register$/);
  });

  test('pairs a POS device with a code confirmed by an admin', async ({ browser }) => {
    const deviceContext = await browser.newContext();
    const adminContext = await browser.newContext();
    try {
      const device = await deviceContext.newPage();
      await device.goto('/device/pair?type=pos');
      await expect(device.getByRole('heading', { name: 'Kasse verbinden' })).toBeVisible();

      const codeLabel = device.getByLabel('Kopplungscode');
      await expect(codeLabel).toHaveText(/^\d{2} \d{2} \d{2}$/);
      const code = (await codeLabel.textContent())!.replace(/\s/g, '');

      // Der Weg ueber den QR-Code: die Adresse traegt den Code schon.
      const admin = await adminContext.newPage();
      await loginAs(admin, TEST_ADMIN);
      await admin.goto(`/devices/verify?code=${code}`);
      await expect(admin.getByText('Gerät gefunden')).toBeVisible();
      await admin.getByRole('button', { name: 'Verknüpfen' }).click();
      await expect(admin.getByText('Erfolgreich verknüpft!')).toBeVisible();

      // Das Geraet fragt alle drei Sekunden nach und wechselt selbst.
      await expect(device).toHaveURL(/\/device\/pos$/, { timeout: 15_000 });
      await expect(device.getByText(EVENT_NAME)).toBeVisible();

      deviceState = await deviceContext.storageState();
    } finally {
      await adminContext.close();
      await deviceContext.close();
    }
  });

  test.describe('with a paired device', () => {
    test.use({ storageState: async ({}, use) => use(deviceState) });

    test('shows the products of the active event after choosing a table', async ({ page }) => {
      const pos = new POSPage(page);
      await pos.goto();
      await pos.startTable('5');

      await expect(page.getByRole('complementary').getByRole('button', { name: new RegExp(CATEGORY) })).toBeVisible();
      await expect(pos.product(PRODUCTS.schorle)).toContainText('3,50');
      await expect(pos.product(PRODUCTS.wasser)).toContainText('2,00');
      await expect(pos.cart).toContainText('Noch nichts bestellt.');
      await expect(pos.payCashButton).toBeDisabled();
    });

    test('adds, changes and clears cart items', async ({ page }) => {
      const pos = new POSPage(page);
      await pos.goto();
      await pos.startTable('7');

      await pos.addProduct(PRODUCTS.schorle);
      await pos.expectCartLine(PRODUCTS.schorle, 1);
      await pos.addProduct(PRODUCTS.schorle);
      await pos.expectCartLine(PRODUCTS.schorle, 2);
      await pos.expectTotal('7,00');

      await pos.addProduct(PRODUCTS.wasser);
      await pos.expectTotal('9,00');
      await expect(pos.cart).toContainText('3 Artikel');

      // Die Mengenknoepfe gehoeren zur jeweiligen Zeile; die erste ist die Schorle.
      await pos.cart.getByRole('button', { name: 'Menge verringern' }).first().click();
      await pos.expectCartLine(PRODUCTS.schorle, 1);
      await pos.expectTotal('5,50');
      await pos.cart.getByRole('button', { name: 'Menge erhöhen' }).nth(1).click();
      await pos.expectCartLine(PRODUCTS.wasser, 2);
      await pos.expectTotal('7,50');

      await pos.clearCartButton.click();
      await expect(pos.cart).toContainText('Noch nichts bestellt.');
      await pos.expectTotal('0,00');
      await expect(pos.payCashButton).toBeDisabled();
    });

    test('completes a cash sale that shows up in the order list', async ({ page, browser }) => {
      const pos = new POSPage(page);
      await pos.goto();
      await pos.startTable('5');

      await pos.addProduct(PRODUCTS.schorle);
      await pos.addProduct(PRODUCTS.schorle);
      await pos.addProduct(PRODUCTS.wasser);
      await pos.expectTotal('9,00');

      await pos.payCashButton.click();
      await expect(pos.cashDialog).toContainText(/Zu zahlen:\s*9,00\s€/);
      await pos.cashDialog.getByRole('button', { name: '20,00 €' }).click();
      await expect(pos.cashDialog).toContainText(/Rückgeld\s*11,00\s€/);
      await pos.cashDialog.getByRole('button', { name: 'Zahlung bestätigen' }).click();

      await expect(pos.cashDialog).toHaveCount(0);
      const confirmation = pos.cart.getByText(/Bestellung #\d{8}-\d{4} erstellt/);
      await expect(confirmation).toBeVisible();
      const orderNumber = (await confirmation.textContent())!.match(/#(\d{8}-\d{4})/)![1];
      await expect(pos.cart).toContainText('Noch nichts bestellt.');

      // Gegenprobe in der Verwaltung: bezahlt, mit Tisch und Positionen.
      const adminContext = await browser.newContext({ storageState: undefined });
      try {
        const admin = await adminContext.newPage();
        await loginAs(admin, TEST_ADMIN);
        await admin.goto('/orders');
        const row = admin.getByRole('row').filter({ hasText: orderNumber });
        await expect(row).toBeVisible();
        await expect(row).toContainText('Tisch 5');
        await expect(row).toContainText('2x Apfelschorle');
        await expect(row).toContainText('1x Wasser');
        await expect(row).toContainText('Bezahlt');
        await expect(row).toContainText('Abgeschlossen');
        await expect(row).toContainText(/9,00\s€/);
      } finally {
        await adminContext.close();
      }
    });
  });
});
