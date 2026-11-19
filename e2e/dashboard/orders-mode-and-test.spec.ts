import type { Page, Route } from '@playwright/test';

import { test, expect } from '../fixtures/test';
import { loginAs } from '../fixtures/auth.fixture';
import { TEST_ADMIN } from '../fixtures/test-data';
import {
  type PairedDevice,
  type PosAdmin,
  createPosEvent,
  deviceOrder,
  pairPosDevice,
  posAdmin,
} from '../fixtures/pos';

/*
 * Bestellungen in der Verwaltung:
 * - Testbestellungen tragen ein „Test“-Abzeichen (Liste und Detail), wie
 *   der Verlauf an der Kasse.
 * - Leere Zellen der Telefon-Ansicht bekommen keinen Trenner „·“.
 * - Betriebsart „Nur Bons“: keine Beträge, Kennzahlen nur Anzahl, Hinweis
 *   wie in der Auswertung. Die E2E-Organisation läuft mit „Alle
 *   Funktionen“ — die Betriebsart kommt hier aus nachgestellten
 *   Antworten von /auth/login und /auth/me.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Apfelschorle';

let admin: PosAdmin;
let device: PairedDevice;
let eventId: string;
let productId: string;

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Verwaltung Bestellliste ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: PRODUCT, price: 3.5 }],
  });
  eventId = event.id;
  productId = event.productIds[PRODUCT];
  device = await pairPosDevice(admin, 'Bestellliste 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

/** Markiert eine Bestellung in Liste und Detail als Testbestellung. */
async function markAsTest(page: Page, orderId: string) {
  const patch = async (route: Route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { data?: unknown };
    const mark = (o: unknown) => {
      if (o && typeof o === 'object' && (o as { id?: string }).id === orderId) (o as { isTest: boolean }).isTest = true;
    };
    if (Array.isArray(json.data)) json.data.forEach(mark);
    else mark(json.data);
    await route.fulfill({ response, json });
  };
  await page.route(/\/api\/organizations\/[^/]+\/orders(\?.*)?$/, patch);
  await page.route(`**/api/organizations/*/orders/${orderId}/history`, patch);
}

/** Organisation in der Betriebsart „Nur Bons“ (Antworten nachgestellt). */
async function ordersOnly(page: Page) {
  const flag = async (route: Route) => {
    const response = await route.fetch();
    const json = (await response.json()) as {
      data?: { user?: { userOrganizations?: Array<{ organization?: Record<string, unknown> }> } };
    };
    for (const uo of json.data?.user?.userOrganizations ?? []) {
      if (uo.organization) {
        Object.assign(uo.organization, {
          operatingMode: 'orders_only',
          pricesVisible: false,
          cashAllowed: false,
          tokensAllowed: false,
        });
      }
    }
    await route.fulfill({ response, json });
  };
  await page.route('**/api/auth/login', flag);
  await page.route('**/api/auth/me', flag);
}

async function search(page: Page, orderNumber: string) {
  await page.goto('/orders');
  await page.getByRole('searchbox', { name: 'Nummer, Tisch oder Produkt' }).fill(orderNumber);
  await expect(page.getByRole('row').filter({ hasText: orderNumber })).toBeVisible();
  return page.getByRole('row').filter({ hasText: orderNumber });
}

test.describe('Orders - test badge, phone list and orders-only mode', () => {
  test('test orders carry a badge in the list and the detail', async ({ page }) => {
    const order = await deviceOrder(admin, device, {
      eventId,
      items: [{ productId, quantity: 1 }],
    });
    await markAsTest(page, order.id);
    await loginAs(page, TEST_ADMIN);

    const row = await search(page, order.orderNumber);
    await expect(row.getByTestId('order-test-badge')).toHaveText('Test');
    await row.click();
    await expect(page.getByTestId('order-detail-test-badge')).toBeVisible();
  });

  test('the phone list leaves out empty cells (no stray separators)', async ({ page }) => {
    const order = await deviceOrder(admin, device, {
      eventId,
      items: [{ productId, quantity: 2 }],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, TEST_ADMIN);

    const row = await search(page, order.orderNumber);
    // Unbezahlt: keine Zahlungsart — die Zelle gilt als leer und bekommt
    // so keinen Trenner „·“.
    const meta = row.locator('.oe-dt__m-meta');
    await expect(meta).toHaveCount(2);
    await expect(meta.first()).toHaveClass(/is-empty/);
    await expect(meta.last()).not.toHaveClass(/is-empty/);
  });

  test('orders-only mode hides money and explains why', async ({ page }) => {
    const order = await deviceOrder(admin, device, {
      eventId,
      items: [{ productId, quantity: 3 }],
    });
    await ordersOnly(page);
    await loginAs(page, TEST_ADMIN);

    const row = await search(page, order.orderNumber);
    await expect(page.getByTestId('orders-order-only-hint')).toContainText('Nur Bons: OpenEOS erfasst kein Geld');
    const summary = page.getByTestId('orders-summary');
    await expect(summary.getByText('Bestellungen', { exact: true })).toBeVisible();
    for (const label of ['Umsatz', 'Ø Bon', 'Pfand']) {
      await expect(summary.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('columnheader', { name: 'Gesamt' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Zahlung' })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Zahlung' })).toHaveCount(0);
    await expect(row).not.toContainText('€');

    await row.click();
    const detail = page.locator('.modal__panel');
    await expect(detail).toContainText(`3x ${PRODUCT}`);
    await expect(detail).not.toContainText('€');
  });
});
