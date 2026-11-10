import { test, expect } from '@playwright/test';

import { createPosEvent, installDevice, pairPosDevice, posAdmin, type PairedDevice, type PosAdmin } from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Kassenbuch an der Kasse (Steuerberater 2026-11-10, Frage 6):
 * Wechselgeld aus der Vereinskasse ist Geldtransit und kein
 * Anfangsbestand. Ohne früheren Kassensturz steht es deshalb vorn; der
 * Anfangsbestand erklärt, dass er nur das Bargeld ist, das beim Öffnen
 * schon in der Kasse liegt.
 */
test.describe.configure({ mode: 'serial' });

let admin: PosAdmin;
let device: PairedDevice;

test.beforeAll(async () => {
  admin = await posAdmin();
  await createPosEvent(admin, {
    name: `Kassenbuch ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'immediate',
    products: [{ name: 'Wasser', price: 2 }],
  });
  device = await pairPosDevice(admin, `Kassenbuch ${Date.now() % 100000}`, { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test.describe('POS - cash book', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('change from the club cash box comes first and is booked on its own', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.openMenu('Kassenbuch');

    const book = page.getByTestId('pos-cashbook');
    await expect(book).toBeVisible();
    const actions = book.locator('.pos-cb__action');
    await expect(actions.first()).toHaveText(/Wechselgeld aus Vereinskasse/);
    await expect(actions.nth(1)).toHaveText(/Anfangsbestand/);
    await expect(book).toContainText('Abschöpfung an Vereinskasse');

    // Anfangsbestand: Hinweis, ohne früheren Kassensturz kein Vorschlag.
    await page.getByTestId('pos-cashbook-opening_balance').click();
    const opening = page.getByRole('dialog', { name: /^Anfangsbestand \(Restbestand aus dem letzten Abschluss\)/ });
    await expect(opening).toBeVisible();
    await expect(page.getByTestId('pos-cashbook-opening-hint')).toContainText(
      'Anfangsbestand ist nur das Bargeld, das beim Öffnen schon in der Kasse liegt.',
    );
    await expect(page.getByTestId('pos-cashbook-last-counted')).toHaveCount(0);
    await opening.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await expect(opening).toBeHidden();

    // Wechselgeld aus der Vereinskasse buchen.
    await page.getByTestId('pos-cashbook-deposit').click();
    const deposit = page.getByRole('dialog', { name: /^Wechselgeld aus Vereinskasse/ });
    await expect(deposit).toBeVisible();
    await deposit.getByRole('button', { name: /^50,00\s€$/ }).click();
    await expect(page.getByTestId('pos-cashbook-amount')).toHaveText(/50,00\s€/);
    await deposit.getByTestId('pos-cashbook-submit').click();

    await expect(page.getByTestId('pos-cashbook-last')).toBeVisible();
    await expect(page.getByTestId('pos-cashbook-entries')).toContainText('Wechselgeld aus Vereinskasse');
    await expect(page.getByTestId('pos-cashbook-expected')).toHaveText(/50,00\s€/);
  });
});
