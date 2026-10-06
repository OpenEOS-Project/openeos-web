import { test, expect } from '@playwright/test';

import {
  createPosEvent,
  createTables,
  deviceOrder,
  letterStamp,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Kasse mit vordefinierten Tischen (Tischmodus `predefined`, Kassiermodus
 * `immediate`; Spezifikation §5.2.1, §5.6): Nummernsuche, Tischliste nach
 * Bereich, Tisch-wählen-Blatt, Status „offen“ mit Betrag, gesendete
 * Bestellungen im Warenkorb, Sammelzahlung und „Serviert“.
 *
 * Tischbezeichnungen sind org-weit eindeutig: Präfix aus Buchstaben je
 * Lauf (Ziffern im Präfix würden die Nummernsuche stören).
 */
test.describe.configure({ mode: 'serial' });

const PRODUCTS = { schorle: 'Apfelschorle', wasser: 'Wasser' } as const;

let admin: PosAdmin;
let device: PairedDevice;
let prefix: string;
let area: string;
let eventId: string;
let productIds: Record<string, string>;
const label = (n: number) => `${prefix}${String(n).padStart(2, '0')}`;

test.beforeAll(async () => {
  admin = await posAdmin();
  prefix = letterStamp();
  area = `Zelt ${prefix}`;
  const created = await createTables(admin, area, prefix, 6);
  const event = await createPosEvent(admin, {
    name: `Tische fest ${prefix}`,
    tables: { mode: 'predefined', areaIds: [created.id] },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.schorle, price: 3.5 },
      { name: PRODUCTS.wasser, price: 2 },
    ],
  });
  eventId = event.id;
  productIds = event.productIds;
  device = await pairPosDevice(admin, 'Kasse fest', { serviceMode: 'table', tableAreaId: created.id });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - predefined tables', () => {
  test.use({ storageState: async ({}, use) => use(device.storageState) });

  test('finds a table by its number', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    // „3“ trifft „…03“
    await pos.openTableByNumber('3', label(3));
  });

  test('an unknown number cannot be opened', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.typeNumber('9');
    await expect(page.getByText('Kein Tisch „9“')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nummer eingeben' })).toBeDisabled();
  });

  test('lists tables by area and switches tables with the sheet', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await page.getByRole('button', { name: 'Tische', exact: true }).click();
    await expect(page.getByRole('region', { name: area })).toBeVisible();
    await expect(pos.tableChip(label(1))).toBeVisible();
    await expect(pos.tableChip(label(6))).toBeVisible();

    await pos.openTableFromList(label(2));
    await pos.addProduct(PRODUCTS.schorle);
    await pos.closeCart();

    await pos.openTableSheet();
    await expect(pos.tableSheet).toContainText(`Aktuell: ${label(2)}`);
    await expect(pos.tableSheet.getByRole('button', { name: new RegExp(`^Tisch ${label(2)}, `) })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await pos.tableSheet.getByRole('button', { name: new RegExp(`^Tisch ${label(4)}, `) }).click();
    await expect(pos.pill(label(4))).toBeVisible();

    // Der Warenkorb von …02 ist geparkt: Liste zeigt ihn als offen mit Betrag.
    await pos.backToStart();
    const chip = pos.tableChip(label(2));
    await expect(chip).toHaveClass(/oe-tablechip--busy/);
    await expect(chip).toContainText(/3,50\s€/);

    // Aufräumen
    await chip.click();
    await pos.openCart();
    await pos.clearCartButton.click();
  });

  test('shows sent orders of a table and pays them with the cart in one batch', async ({ page }) => {
    // Eine gesendete Runde für …05 (wie von einem zweiten Gerät).
    await deviceOrder(admin, device, {
      eventId,
      tableNumber: label(5),
      source: 'pos',
      items: [{ productId: productIds[PRODUCTS.wasser], quantity: 1 }],
    });

    const pos = new POSPage(page);
    await pos.goto();
    await pos.expectOpenTable(label(5), '2,00');
    await page.getByRole('button', { name: 'Tische', exact: true }).click();
    await expect(pos.tableChip(label(5))).toHaveClass(/oe-tablechip--busy/);

    await pos.openTableFromList(label(5));
    await pos.openCart();
    await expect(pos.cart.getByRole('region', { name: 'Gesendet' })).toContainText(PRODUCTS.wasser);
    await pos.closeCart();
    await pos.addProduct(PRODUCTS.schorle);
    await pos.expectTotal('5,50');

    await pos.checkout();
    await expect(pos.paySheet).toContainText(/Zu zahlen\s*5,50\s€/);
    await pos.payCash('10,00 €');
    await pos.completePayment();
    await expect(pos.doneSheet).toContainText('2 Bestellungen');
    await pos.nextReceipt();

    await expect(pos.startView).toBeVisible();
    await expect(pos.openTableRow(`Tisch ${label(5)}`)).toHaveCount(0);
  });

  test('marks ready items as served', async ({ page }) => {
    // Station „fertig“ nachgestellt: die offenen Bestellungen des Tisches
    // und das Servieren kommen aus Attrappen.
    let delivered = false;
    const order = (status: string) => ({
      id: 'e2e-order',
      orderNumber: '20260301-0999',
      dailyNumber: 999,
      source: 'pos',
      fulfillmentType: 'table_service',
      tableNumber: label(6),
      subtotal: 2,
      discountAmount: 0,
      total: 2,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'e2e-item',
          productName: PRODUCTS.wasser,
          quantity: 1,
          paidQuantity: 0,
          status,
          totalPrice: 2,
          options: { selected: [] },
          notes: null,
          kitchenNotes: null,
        },
      ],
    });
    await page.route('**/device-api/orders/open?*', (route) =>
      route.request().url().includes('tableKey=')
        ? route.fulfill({ json: { data: [order(delivered ? 'delivered' : 'ready')] } })
        : route.continue(),
    );
    await page.route('**/device-api/order-items/deliver', (route) => {
      delivered = true;
      return route.fulfill({ json: { data: { delivered: [{ id: 'e2e-item' }], skipped: [] } } });
    });

    const pos = new POSPage(page);
    await pos.goto();
    await pos.openTableByNumber('6', label(6));
    await pos.openCart();
    await expect(pos.cart).toContainText('1 Artikel fertig zum Servieren');
    await pos.cart.getByRole('button', { name: 'Serviert' }).click();
    await expect(page.getByText('1 Position serviert')).toBeVisible();
    await expect(pos.cart).not.toContainText('fertig zum Servieren');
    await expect(pos.cartLine(PRODUCTS.wasser)).toContainText('serviert');
  });
});
