import { test, expect, type Page } from '@playwright/test';

import { apiPost } from '../fixtures/api';
import { createPosEvent, installDevice, pairPosDevice, posAdmin, type PairedDevice, type PosAdmin } from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Wertmarken an der Kasse (Steuerberater 2026-11-10, Frage 13): Marken
 * verkaufen (bar), mit Marken bezahlen (Rest bar), Überzahlung nur als
 * Trinkgeld, Rücktausch nur für freigegebene Typen. Die selbst betriebene
 * Installation läuft als „Alle Funktionen“ — dort sind Marken erlaubt.
 * Je Bildschirmgröße (Telefon, Tablet, Desktop) einmal.
 *
 * SHOT_DIR=<ordner> legt Bildschirmfotos ab.
 */
test.describe.configure({ mode: 'serial' });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

let admin: PosAdmin;
let device: PairedDevice;
let markeName = '';

test.beforeAll(async ({}, testInfo) => {
  // Die drei Bildschirmgrößen stehen unten selbst — einmal reicht.
  test.skip(testInfo.project.name !== 'chromium', 'eigene Bildschirmgrößen');
  admin = await posAdmin();
  const stamp = Date.now();
  await createPosEvent(admin, {
    name: `Wertmarken ${stamp}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [
      { name: 'Bier', price: 4 },
      { name: 'Wurst', price: 3 },
    ],
  });
  const org = admin.organizationId;
  markeName = `Festmarke ${stamp % 100000}`;
  await apiPost(admin.api, `organizations/${org}/token-types`, admin.headers, {
    name: markeName,
    value: 2,
    color: '#f59e0b',
    buybackAllowed: true,
  });
  device = await pairPosDevice(admin, `Marken ${stamp % 100000}`, { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin?.api.dispose();
});

async function shot(page: Page, name: string) {
  const dir = process.env.SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

for (const [index, viewport] of VIEWPORTS.entries()) {
  test.describe(`POS - tokens (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await installDevice(page, device);
    });

    test('sell tokens, pay with tokens and cash, overpay only as tip, buy back', async ({ page }) => {
      const nr = String(index * 10 + 1).padStart(2, '0');
      const pos = new POSPage(page);
      await pos.goto();
      const marke = page.getByRole('button', { name: `Eine ${markeName} mehr`, exact: true });

      // 1. Verkaufen: 6 Marken bar (eine bleibt für den Rücktausch im Umlauf).
      await pos.openMenu('Wertmarken verkaufen');
      const sale = page.getByTestId('token-sale-sheet');
      await expect(sale).toBeVisible();
      for (let i = 0; i < 6; i++) await marke.click();
      await expect(sale).toContainText('Mehrzweck-Gutschein');
      await page.getByRole('button', { name: 'Passend', exact: true }).click();
      await shot(page, `${nr}-${viewport.name}-marken-verkaufen`);
      await page.getByRole('button', { name: /^12,00\s€ kassieren$/ }).click();
      const done = page.getByTestId('token-done');
      await expect(done).toBeVisible();
      await expect(done).toContainText('Marken verkauft');
      await expect(done).toContainText(/W-\d{8}-\d{4}/);
      await shot(page, `${nr}-${viewport.name}-verkauft`);
      await done.getByRole('button', { name: 'Fertig' }).click();

      // 2. Bezahlen: Bier + Wurst (7 €) mit 3 Marken (6 €) + 1 € bar.
      await pos.addProduct('Bier');
      await pos.addProduct('Wurst');
      await pos.checkout();
      await pos.paySheet.getByRole('radio', { name: /^Wertmarken/ }).click();
      for (let i = 0; i < 3; i++) await pos.paySheet.getByRole('button', { name: `Eine ${markeName} mehr`, exact: true }).click();
      await expect(pos.paySheet).toContainText(/Rest 1,00\s€/);
      await shot(page, `${nr}-${viewport.name}-bezahlen-mit-marken`);
      await pos.paySheet.getByRole('button', { name: /^Rest kassieren: 1,00\s€$/ }).click();
      await pos.paySheet.getByRole('button', { name: 'Passend', exact: true }).click();
      await pos.completePayment();
      await expect(pos.doneSheet).toContainText('Bar + Wertmarken');
      await expect(pos.doneSheet).toContainText('bezahlt mit Wertmarken');
      await shot(page, `${nr}-${viewport.name}-bezahlt-bar-und-marken`);
      await pos.nextReceipt();

      // 3. Überzahlung: Wurst (3 €) mit 2 Marken (4 €) — nur als Trinkgeld.
      await pos.addProduct('Wurst');
      await pos.checkout();
      await pos.paySheet.getByRole('radio', { name: /^Wertmarken/ }).click();
      for (let i = 0; i < 2; i++) await pos.paySheet.getByRole('button', { name: `Eine ${markeName} mehr`, exact: true }).click();
      await expect(pos.paySheet).toContainText(/Die Marken sind 1,00\s€ zu viel/);
      const pay = pos.paySheet.getByRole('button', { name: 'Mit Wertmarken bezahlen' });
      await expect(pay).toBeDisabled();
      await pos.paySheet.getByLabel(/Rest 1,00\s€ als Trinkgeld buchen/).check();
      await shot(page, `${nr}-${viewport.name}-ueberzahlung-trinkgeld`);
      await pay.click();
      await expect(pos.doneSheet).toBeVisible();
      await expect(pos.doneSheet).toContainText('Wertmarken');
      await pos.nextReceipt();

      // 4. Rücktausch: 1 Marke gegen Bargeld.
      await pos.openMenu('Wertmarken zurücktauschen');
      const back = page.getByTestId('token-buyback-sheet');
      await expect(back).toBeVisible();
      await marke.click();
      await shot(page, `${nr}-${viewport.name}-ruecktausch`);
      await page.getByRole('button', { name: /^2,00\s€ auszahlen$/ }).click();
      await expect(page.getByTestId('token-done')).toContainText('Marken zurückgetauscht');
      await page.getByTestId('token-done').getByRole('button', { name: 'Fertig' }).click();
    });
  });
}
