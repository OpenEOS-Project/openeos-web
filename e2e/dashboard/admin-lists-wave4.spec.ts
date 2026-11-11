import { test, expect } from '../fixtures/auth.fixture';
import { TEST_ORG } from '../fixtures/test-data';
import { VIEWPORTS, expectNoHorizontalOverflow, runRowAction, trackConsoleErrors } from '../fixtures/responsive';

/*
 * Super-Admin-Liste „Organisationen“ auf DataTable (@openeos/ui 0.7): in
 * jeder Größe ohne waagerechtes Scrollen, Aktionen erreichbar (Symbolknopf
 * mit Tooltip bzw. ⋯-Menü auf dem Telefon), keine Konsolenfehler. Der
 * E2E-Administrator ist Super-Admin und Admin von „E2E Verein“.
 */
for (const viewport of VIEWPORTS) {
  test(`organizations list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/organizations');
    await expect(page.getByRole('heading', { name: 'Organisationen', level: 1 })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: TEST_ORG.name }).first();
    await expect(row).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Kopf: nur ein Symbol, Name als aria-label und Tooltip.
    await expect(page.getByRole('button', { name: 'Organisation erstellen' })).toBeVisible();

    await runRowAction(page, row, 'Bearbeiten', viewport);
    const form = page.locator('.modal__panel');
    await expect(form.getByRole('textbox', { name: /^Name/ })).toHaveValue(TEST_ORG.name);
    await form.getByRole('button', { name: 'Schließen' }).first().click();
    await expect(form).toHaveCount(0);

    // Betriebsart und Löschen stehen im ⋯-Menü.
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    await expect(page.getByRole('menuitem', { name: 'Betriebsart & Land', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Löschen', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    expect(errors()).toEqual([]);
  });
}
