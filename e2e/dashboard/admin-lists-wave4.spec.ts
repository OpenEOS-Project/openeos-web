import { test, expect } from '../fixtures/auth.fixture';
import { TEST_USER } from '../fixtures/test-data';
import { VIEWPORTS, expectNoHorizontalOverflow, runRowAction, trackConsoleErrors } from '../fixtures/responsive';

/*
 * Super-Admin-Liste „Benutzer“ auf DataTable (@openeos/ui 0.7): in jeder
 * Größe ohne waagerechtes Scrollen, Aktion erreichbar (Symbolknopf mit
 * Tooltip bzw. ⋯-Menü auf dem Telefon), keine Konsolenfehler. Der
 * E2E-Administrator ist Super-Admin. (Die Organisationsliste nutzt
 * Endpunkte des gehosteten Angebots, die eine eigenständige Installation
 * ausblendet — deshalb hier die Benutzerliste.)
 */
for (const viewport of VIEWPORTS) {
  test(`users list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Benutzer', level: 1 })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: TEST_USER.email });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`${TEST_USER.firstName} ${TEST_USER.lastName}`);
    await expectNoHorizontalOverflow(page);

    await runRowAction(page, row, 'Details anzeigen', viewport);
    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);

    expect(errors()).toEqual([]);
  });
}
