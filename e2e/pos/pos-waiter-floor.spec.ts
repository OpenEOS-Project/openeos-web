import { test, expect, type Page } from '@playwright/test';

import { apiPost, ensureOk } from '../fixtures/api';
import {
  createPosEvent,
  createTables,
  installDevice,
  letterStamp,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Tischplan mit Bedienungen: Ein offener Tisch trägt Farbe und Kurzname
 * der verantwortlichen Bedienung; der Chip bietet „Mein Zwischenstand“.
 * Bildschirmfotos nur mit WAITERS_SHOTS_DIR (lokale Abnahme).
 */
test.describe.configure({ mode: 'serial' });

const PRODUCT = 'Spezi';
const SHOTS = process.env.WAITERS_SHOTS_DIR;

let admin: PosAdmin;
let till: PairedDevice;
let prefix: string;
const mia = { id: '', pin: '' };

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const project = test.info().project.name;
  await page.screenshot({ path: `${SHOTS}/${name}-${project}.png`, fullPage: true });
}

test.beforeAll(async () => {
  admin = await posAdmin();
  prefix = letterStamp();
  const area = await createTables(admin, `Saal ${prefix}`, prefix, 6, { cols: 3, gap: 40 });
  const event = await createPosEvent(admin, {
    name: `Tischplan Bedienungen ${prefix}`,
    tables: { mode: 'predefined', areaIds: [area.id] },
    orderingMode: 'tab',
    products: [{ name: PRODUCT, price: 3 }],
  });
  const [created] = await apiPost<Array<{ id: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    { eventId: event.id, items: [{ name: `Mia Wagner ${prefix}`, shortName: 'Mia' }] },
  );
  mia.id = created.id;
  mia.pin = created.pin;
  till = await pairPosDevice(admin, 'Kasse Saal', { serviceMode: 'table', tableAreaId: area.id, waiterMode: 'shared' });
  const other = await pairPosDevice(admin, 'Kasse Saal 2', { serviceMode: 'table', waiterMode: 'shared' });

  const session = await admin.api.post('device-api/waiter-session', {
    headers: { 'x-device-token': other.token },
    data: { pin: mia.pin },
  });
  await ensureOk(session, 'Bedienung anmelden');
  const res = await admin.api.post('device-api/orders', {
    headers: { 'x-device-token': other.token, 'x-waiter-session': (await session.json()).data.token },
    data: { eventId: event.id, tableNumber: `${prefix}02`, items: [{ productId: event.productIds[PRODUCT], quantity: 2 }] },
  });
  await ensureOk(res, 'Bestellung anlegen');
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test('the floor plan shows the colour and short name of the responsible server', async ({ page }) => {
  await installDevice(page, till);
  const pos = new POSPage(page);
  await pos.goto();
  await pos.enterPin(mia.pin);
  await expect(pos.waiterChip()).toContainText('Mia');

  const table = pos.floorTable(`${prefix}02`);
  await expect(table).toHaveClass(/oe-floor__table--busy/);
  await expect(table.getByTestId('pos-floor-owner')).toHaveText('Mia');
  await expect(table).toHaveAccessibleName(new RegExp(`^Tisch ${prefix}02, .*Mia$`));
  await shot(page, '05-kasse-tischplan-farbe');

  await pos.waiterChip().click();
  await expect(page.getByRole('menuitem', { name: 'Mein Zwischenstand' })).toBeVisible();
  // Bedienung ohne Schichtleitung: „Abrechnen“ steht nicht im Menü.
  await expect(page.getByRole('menuitem', { name: 'Abrechnen' })).toHaveCount(0);
  await shot(page, '06-kasse-chip-menue');
});
