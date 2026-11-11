import { test, expect } from '../fixtures/auth.fixture';
import { createPosEvent, pairPosDevice, posAdmin, postDeviceOrder, type PosAdmin } from '../fixtures/pos';
import { VIEWPORTS, expectNoHorizontalOverflow, runRowAction, trackConsoleErrors } from '../fixtures/responsive';

/*
 * Admin-Listen auf DataTable (@openeos/ui 0.7): in jeder Größe ohne
 * waagerechtes Scrollen, Aktionen erreichbar (Symbolknopf mit Tooltip bzw.
 * ⋯-Menü auf dem Telefon), keine Konsolenfehler.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Apfelschorle mit einem sehr langen Namen für die Kürzung';
let admin: PosAdmin;
let eventName: string;
let orderNumber: string;

test.beforeAll(async () => {
  admin = await posAdmin();
  eventName = `Listen ${Date.now()}`;
  const event = await createPosEvent(admin, {
    name: eventName,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCT, price: 3.5 },
      { name: 'Wasser', price: 2 },
    ],
  });
  const device = await pairPosDevice(admin, 'Listen 1', { serviceMode: 'counter' });
  const res = await postDeviceOrder(admin, device, {
    eventId: event.id,
    items: [{ productId: event.productIds[PRODUCT], quantity: 2 }],
    payment: { paymentMethod: 'cash', amountReceived: 20 },
  });
  expect(res.ok()).toBeTruthy();
  orderNumber = ((await res.json()).data as { orderNumber: string }).orderNumber;
});

test.afterAll(async () => {
  await admin.api.dispose();
});

for (const viewport of VIEWPORTS) {
  test(`products list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/products');

    const row = page.getByRole('row').filter({ hasText: PRODUCT });
    await expect(row).toBeVisible();
    await expect(row).toContainText('3,50');
    await expectNoHorizontalOverflow(page);

    // Kopf: nur Symbole, Name als aria-label und Tooltip.
    await expect(page.getByRole('button', { name: 'Produkt erstellen' })).toBeVisible();

    await runRowAction(page, row, 'Bearbeiten', viewport);
    const form = page.locator('.modal__panel');
    await expect(form.getByRole('textbox', { name: /^Name/ })).toHaveValue(PRODUCT);
    await form.getByRole('button', { name: 'Schließen' }).first().click();
    await expect(form).toHaveCount(0);

    expect(errors()).toEqual([]);
  });

  test(`orders list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/orders');

    if (viewport.phone) {
      // Filter liegen auf dem Telefon in einem Sheet hinter dem Filter-Knopf.
      await page.getByRole('button', { name: 'Filter' }).click();
      await page.getByRole('dialog').getByLabel('Veranstaltung').selectOption({ label: eventName });
      await page.getByRole('button', { name: 'Anwenden' }).click();
    } else {
      await page.getByRole('combobox').filter({ hasText: 'Alle Veranstaltungen' }).selectOption({ label: eventName });
    }

    const row = page.getByRole('row').filter({ hasText: orderNumber });
    await expect(row).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2); // Kopf + eine Bestellung
    await expectNoHorizontalOverflow(page);

    // Zeilenklick öffnet die Bestellung.
    await row.click();
    await expect(page.locator('.modal__panel').getByText(orderNumber)).toBeVisible();

    expect(errors()).toEqual([]);
  });
}
