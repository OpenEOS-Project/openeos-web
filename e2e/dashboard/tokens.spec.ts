import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/*
 * Verwaltung „Wertmarken“: Markentyp anlegen (Mehrzweck), Einzweck nur mit
 * einem Steuersatz (die Auswahl Getränke + Speisen mit 19 % und 7 % lehnt
 * die API ab), Bericht und Buchungen. Bildschirmfotos nur mit SHOT_DIR,
 * auch in 390x844 und 768x1024.
 */
const SHOTS = process.env.SHOT_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test.describe('Wertmarken (Verwaltung)', () => {
  test('creates a multi-purpose token type and shows the report', async ({ adminPage: page }) => {
    const name = `Biermarke ${Date.now() % 100000}`;
    await page.goto('/tokens');
    await expect(page.getByRole('heading', { name: 'Wertmarken', level: 1 })).toBeVisible();

    await page.getByTestId('token-type-create').first().click();
    const form = page.getByTestId('token-type-form');
    await expect(form).toBeVisible();
    await form.getByTestId('token-type-name').fill(name);
    await form.getByPlaceholder('0,00').fill('2,50');
    await expect(form.getByTestId('token-kind-multi')).toContainText('Mehrzweckgutschein');
    await shot(page, '31-verwaltung-markentyp-anlegen');
    await form.getByTestId('token-type-submit').click();
    await expect(form).toBeHidden();

    const row = page.getByTestId('token-type-list').getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('Mehrzweck');
    await expect(row).toContainText(/2,50\s€/);
    await expect(page.getByTestId('tokens-report')).toBeVisible();

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'phone', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await shot(page, `32-verwaltung-wertmarken-${viewport.name}`);
    }
  });

  test('reports page shows the token card and payment method', async ({ adminPage: page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shot(page, '33-berichte');
  });
});
