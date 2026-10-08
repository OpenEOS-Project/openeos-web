import { test, expect, type Page } from '@playwright/test';

import {
  createPosEvent,
  createTables,
  deviceOrder,
  installDevice,
  letterStamp,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Restaurant-Ansicht (Karte) der Kasse (Spezifikation §5.2.1, P5): Karte
 * als Standard, wenn der Standardbereich einen Tischplan hat (F7), Reiter
 * je Bereich, Tipp öffnet, Farben nach Status, Wartegrund, Karte im
 * Tisch-wählen-Blatt mit markiertem aktuellem Tisch, ohne Tischplan keine
 * Karte.
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Apfelschorle';

let admin: PosAdmin;
let device: PairedDevice;
let prefix: string;
let other: string;
let area: string;
let otherArea: string;
let eventId: string;
let productIds: Record<string, string>;
const label = (n: number, p = prefix) => `${p}${String(n).padStart(2, '0')}`;

test.beforeAll(async () => {
  admin = await posAdmin();
  prefix = letterStamp();
  do other = letterStamp();
  while (other === prefix);
  area = `Zelt ${prefix}`;
  otherArea = `Garten ${other}`;
  const main = await createTables(admin, area, prefix, 6, { cols: 3, gap: 40 });
  const garden = await createTables(admin, otherArea, other, 3, { cols: 3, gap: 40 });
  const event = await createPosEvent(admin, {
    name: `Karte ${prefix}`,
    tables: { mode: 'predefined', areaIds: [main.id, garden.id] },
    orderingMode: 'immediate',
    products: [{ name: PRODUCT, price: 3.5 }],
  });
  eventId = event.id;
  productIds = event.productIds;
  device = await pairPosDevice(admin, 'Kasse Karte', { serviceMode: 'table', tableAreaId: main.id });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

const segment = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('POS - floor plan', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('starts on the map when the device area has a floor plan and opens a tapped table', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.startView).toBeVisible();
    // Ohne Einstellung: Karte (Standardbereich mit Tischplan), kein Umschalter.
    await expect(segment(page, 'Karte')).toHaveCount(0);
    await expect(page.getByText('Tisch auf der Karte antippen.')).toBeVisible();
    await expect(page.getByRole('group', { name: `Tischplan ${area}` })).toBeVisible();

    // Zwei Bereiche mit Tischplan → Reiter, der Gerätebereich zuerst.
    await expect(page.getByRole('tab', { name: area })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: otherArea }).click();
    await expect(pos.floorTable(label(1, other))).toBeVisible();
    await page.getByRole('tab', { name: area }).click();

    // Telefon: die Karte ist breiter als der Bildschirm und scrollt.
    if ((page.viewportSize()?.width ?? 1280) < 500) {
      await expect(page.getByText('Zum Verschieben wischen')).toBeVisible();
    }

    await pos.openTableOnMap(label(2));
  });

  test('colours tables by state and shows why a table is waiting', async ({ page }) => {
    // …03 offen (gesendete Runde), …04 wartet auf eine Gastbestellung (Attrappe).
    await deviceOrder(admin, device, {
      eventId,
      tableNumber: label(3),
      source: 'pos',
      items: [{ productId: productIds[PRODUCT], quantity: 1 }],
    });
    await page.route(/\/device-api\/tables\/status/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const now = new Date().toISOString();
      json.data.unshift({
        key: label(4),
        tableId: null,
        label: label(4),
        areaId: null,
        status: 'wait',
        waitReason: 'guest',
        openAmount: 0,
        itemCount: 1,
        orderIds: ['e2e-guest'],
        waitingSince: now,
        lastActivityAt: now,
      });
      await route.fulfill({ response, json });
    });

    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.floorTable(label(3))).toHaveClass(/oe-floor__table--busy/);
    await expect(pos.floorTable(label(3))).toContainText(/3,50\s€/);
    await expect(pos.floorTable(label(4))).toHaveClass(/oe-floor__table--wait/);
    await expect(pos.floorTable(label(4))).toContainText('Gast');
    await expect(pos.floorTable(label(4))).toHaveAccessibleName(`Tisch ${label(4)}, wartet: Gastbestellung`);
    await expect(pos.floorTable(label(1))).not.toHaveClass(/oe-floor__table--(busy|wait)/);
    await expect(pos.openTableRow(`Tisch ${label(4)}`)).toContainText('Gastbestellung');
  });

  test('shows room shape, walls and zones on the map, only tables are tappable', async ({ page }) => {
    await page.route(/\/device-api\/tables(\?|$)/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      for (const a of json.data.areas) {
        a.outline = [
          { x: 0, y: 0 },
          { x: a.width, y: 0 },
          { x: a.width, y: a.height - 120 },
          { x: a.width - 160, y: a.height },
          { x: 0, y: a.height },
        ];
        a.decor = [
          ...a.decor,
          { id: 'e2e-wall', type: 'wall', points: [{ x: 0, y: 0 }, { x: a.width, y: 0 }], thickness: 12 },
          {
            id: 'e2e-kitchen',
            type: 'zone',
            zoneType: 'kitchen',
            points: [
              { x: a.width - 300, y: 20 },
              { x: a.width - 20, y: 20 },
              { x: a.width - 20, y: 200 },
              { x: a.width - 300, y: 200 },
            ],
          },
        ];
      }
      await route.fulfill({ response, json });
    });

    const pos = new POSPage(page);
    await pos.goto();
    const plan = page.locator('.pos-floor');
    await expect(plan.locator('.oe-floor__outside')).toHaveCount(1);
    await expect(plan.locator('.oe-floor__wall-line')).toHaveCount(1);
    await expect(plan.locator('.oe-floor__zone--kitchen')).toHaveCount(1);
    await expect(plan.locator('.oe-floor__zonelabel--kitchen')).toContainText('Küche');
    // Zonen und Wände sind reine Darstellung.
    await expect(plan.locator('.oe-floor__svg [role="button"]')).toHaveCount(0);
    await pos.openTableOnMap(label(2));
  });

  test('the table sheet shows the same view as the start view, without a switch', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.openTableOnMap(label(1));
    await pos.closeCart();

    await pos.openTableSheet();
    await expect(pos.tableSheet.getByRole('button', { name: 'Liste', exact: true })).toHaveCount(0);
    await expect(pos.floorTable(label(1), pos.tableSheet)).toHaveAttribute('aria-current', 'true');
    await pos.floorTable(label(5), pos.tableSheet).click();
    await expect(pos.pill(label(5))).toBeVisible();
  });

  test('follows the table selection set for the device, live', async ({ page }) => {
    const setView = async (tableSelectView: string | null) => {
      const res = await admin.api.patch(`organizations/${admin.organizationId}/devices/${device.deviceId}`, {
        headers: admin.headers,
        data: { settings: { tableSelectView } },
      });
      expect(res.ok()).toBeTruthy();
    };
    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.floorTable(label(1))).toBeVisible();
    try {
      await setView('list');
      await expect(pos.tableChip(label(1))).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.pos-floor')).toHaveCount(0);

      await setView('number');
      await expect(segment(page, '1')).toBeVisible({ timeout: 15_000 });
      await expect(pos.tableChip(label(1))).toHaveCount(0);

      await page.reload();
      await expect(pos.startView).toBeVisible();
      await expect(segment(page, '1')).toBeVisible();
    } finally {
      await setView(null);
    }
    await expect(pos.floorTable(label(1))).toBeVisible({ timeout: 15_000 });
  });

  test('falls back to the list without a floor plan', async ({ page }) => {
    // Alle Tische auf 0/0 = kein Tischplan.
    await page.route(/\/device-api\/tables(\?|$)/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      for (const a of json.data.areas) for (const t of a.tables) Object.assign(t, { x: 0, y: 0 });
      await route.fulfill({ response, json });
    });

    const pos = new POSPage(page);
    await pos.goto();
    await expect(pos.startView).toBeVisible();
    await expect(pos.tableChip(label(1))).toBeVisible();
    await expect(segment(page, 'Karte')).toHaveCount(0);
    await expect(page.locator('.pos-floor')).toHaveCount(0);
  });
});
