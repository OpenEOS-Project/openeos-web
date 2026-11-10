import { test, expect } from '../fixtures/auth.fixture';
import type { Locator, Page } from '@playwright/test';

import { apiPost, ensureOk } from '../fixtures/api';
import { createPosEvent, pairPosDevice, posAdmin, type PairedDevice, type PosAdmin } from '../fixtures/pos';

/*
 * Live-Kassensturz und Kartentrinkgeld in der Verwaltung (Steuerberater
 * 2026-11-10, Fragen 5 und 7): Soll je Bedienung seit der letzten
 * Abrechnung, Auszahlung von Kartentrinkgeld nur für Arbeitnehmer, beim
 * Abrechnen per Häkchen. Bildschirmfotos nur mit LIVE_AUDIT_SHOTS_DIR
 * (1440x900, 768x1024, 390x844).
 */
test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.LIVE_AUDIT_SHOTS_DIR;
const SIZES = [
  { name: '', width: 1440, height: 900 },
  { name: '-tablet', width: 768, height: 1024 },
  { name: '-mobil', width: 390, height: 844 },
] as const;

async function shots(page: Page, name: string, target?: Locator) {
  if (!SHOTS) return;
  const original = page.viewportSize();
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(200);
    if (target) await target.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${name}${size.name}.png` });
  }
  if (original) await page.setViewportSize(original);
}

let admin: PosAdmin;
let device: PairedDevice;
const stamp = Date.now() % 1000;
const mia = { id: '', name: `Mia Hofmann ${stamp}`, pin: '' };
const tom = { id: '', name: `Tom Weber ${stamp}`, pin: '' };

test.beforeAll(async () => {
  admin = await posAdmin();
  const event = await createPosEvent(admin, {
    name: `Live-Kassensturz ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'tab',
    products: [{ name: 'Radler', price: 4 }],
  });
  const eventId = event.id;
  const productId = event.productIds['Radler'];
  const created = await apiPost<Array<{ id: string; pin: string }>>(
    admin.api,
    `organizations/${admin.organizationId}/waiters/bulk`,
    admin.headers,
    { eventId, items: [{ name: mia.name, shortName: 'Mia' }, { name: tom.name, shortName: 'Tom' }] },
  );
  [mia.id, mia.pin] = [created[0].id, created[0].pin];
  [tom.id, tom.pin] = [created[1].id, created[1].pin];
  // Mia ist angestellt (Minijob), Tom ehrenamtlich.
  const patch = await admin.api.patch(`organizations/${admin.organizationId}/waiters/${mia.id}`, {
    headers: admin.headers,
    data: { isEmployee: true },
  });
  await ensureOk(patch, 'Arbeitnehmer setzen');
  device = await pairPosDevice(admin, 'Kasse Festzelt', { serviceMode: 'table', waiterMode: 'shared' });

  const book = async (pin: string, payments: Array<Record<string, unknown>>) => {
    const session = await admin.api.post('device-api/waiter-session', {
      headers: { 'x-device-token': device.token },
      data: { pin },
    });
    await ensureOk(session, 'Bedienung anmelden');
    const token = (await session.json()).data.token as string;
    for (const payment of payments) {
      const res = await admin.api.post('device-api/orders', {
        headers: { 'x-device-token': device.token, 'x-waiter-session': token },
        data: { eventId, items: [{ productId, quantity: 2 }], payment },
      });
      await ensureOk(res, 'Bestellung');
    }
  };
  await book(mia.pin, [
    { paymentMethod: 'cash', amountReceived: 10, tipAmount: 1 },
    { paymentMethod: 'card', tipAmount: 3 },
  ]);
  await book(tom.pin, [
    { paymentMethod: 'cash', amountReceived: 10 },
    { paymentMethod: 'card', tipAmount: 2 },
  ]);
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('Live-Kassensturz (Verwaltung)', () => {
  test('shows the expected cash per server and pays out card tips only to employees', async ({ adminPage: page }) => {
    await page.goto('/waiters');
    const section = page.getByTestId('waiter-settlements');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toContainText('Kellnerabrechnungen werden ausschließlich elektronisch erzeugt und aufbewahrt.');
    await section.getByRole('button', { name: 'Live-Kassensturz' }).click();

    const live = page.getByTestId('live-audit');
    await expect(live).toContainText('Für eine Kassen-Nachschau: das Soll jeder Bedienung seit ihrer letzten Abrechnung.');
    const table = live.getByTestId('live-audit-table');
    const miaRow = table.getByRole('row').filter({ hasText: mia.name });
    const tomRow = table.getByRole('row').filter({ hasText: tom.name });
    await expect(miaRow).toContainText('9,00');
    await expect(miaRow).toContainText('Kasse Festzelt');
    await expect(miaRow).toContainText('3,00');
    await expect(tomRow).toBeVisible();
    // Ehrenamtlich: kein Auszahlen.
    await expect(tomRow.getByTestId('live-audit-payout')).toHaveCount(0);
    await expect(live).toContainText('Bei Ehrenamtlichen gehört das Trinkgeld dem Verein');
    await shots(page, '90-verwaltung-live-kassensturz', live);

    // Mia bekommt 1 € von 3 € bar.
    await miaRow.getByTestId('live-audit-payout').click();
    const dialog = page.getByRole('dialog', { name: `Kartentrinkgeld für ${mia.name}` });
    await expect(dialog).toContainText('Offenes Kartentrinkgeld: 3,00');
    await shots(page, '91-verwaltung-kartentrinkgeld-auszahlen');
    await dialog.getByRole('textbox').first().fill('1,00');
    await dialog.getByTestId('tip-payout-submit').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(new RegExp(`1,00\\s€ Kartentrinkgeld an ${mia.name} ausgezahlt`))).toBeVisible();
    await expect(miaRow).toContainText('2,00');
  });

  test('settles an employee and pays out the open card tips with it', async ({ adminPage: page }) => {
    await page.goto('/waiters');
    const row = page.getByTestId('waiters-table').getByRole('row').filter({ hasText: mia.name });
    await row.getByRole('button', { name: `${mia.name} abrechnen` }).click();
    const modal = page.getByRole('dialog', { name: `${mia.name} abrechnen` });
    const tips = modal.getByTestId('settle-tip-payout');
    await expect(tips).toContainText(/Offenes Kartentrinkgeld \(2,00\s€\) bar auszahlen/);
    await tips.getByRole('checkbox').check();
    await shots(page, '92-verwaltung-abrechnen-kartentrinkgeld');

    const settled = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/waiters\/[^/]+\/settlements$/.test(new URL(r.url()).pathname),
    );
    await modal.getByTestId('settle-submit').click();
    const body = (await (await settled).json()) as { meta?: { tipPayout?: { amount: number } | null } };
    expect(body.meta?.tipPayout?.amount).toBe(2);

    const detail = page.getByTestId('settlement-detail');
    await expect(detail).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kopie drucken' })).toBeVisible();
    await shots(page, '93-verwaltung-abrechnung-kopie');
    await page.getByRole('button', { name: 'Schließen' }).last().click();
  });

  test('a volunteer gets the explanation instead of a payout', async ({ adminPage: page }) => {
    await page.goto('/waiters');
    const row = page.getByTestId('waiters-table').getByRole('row').filter({ hasText: tom.name });
    await row.getByRole('button', { name: `${tom.name} abrechnen` }).click();
    const modal = page.getByRole('dialog', { name: `${tom.name} abrechnen` });
    await expect(modal.getByTestId('settle-tips-volunteer')).toContainText('Das Trinkgeld gehört dem Verein');
    await expect(modal.getByTestId('settle-tip-payout')).toHaveCount(0);
  });
});
