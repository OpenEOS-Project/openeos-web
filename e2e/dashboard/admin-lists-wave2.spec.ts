import { test, expect } from '../fixtures/auth.fixture';
import { apiPost } from '../fixtures/api';
import { createPosEvent, posAdmin, type PosAdmin } from '../fixtures/pos';
import { VIEWPORTS, expectNoHorizontalOverflow, runRowAction, trackConsoleErrors } from '../fixtures/responsive';

/*
 * Admin-Listen der zweiten Welle auf DataTable (@openeos/ui 0.7), am
 * Beispiel „Bedienungen“: in jeder Größe ohne waagerechtes Scrollen,
 * Zeilenaktionen erreichbar (Symbolknopf mit Tooltip bzw. ⋯-Menü auf dem
 * Telefon), der Veranstaltungsfilter auf dem Telefon im Sheet, keine
 * Konsolenfehler.
 */
test.describe.configure({ mode: 'serial' });

let admin: PosAdmin;
let waiterName: string;
let eventName: string;

test.beforeAll(async () => {
  admin = await posAdmin();
  const stamp = Date.now() % 100000;
  eventName = `Listen Bedienungen ${stamp}`;
  const event = await createPosEvent(admin, {
    name: eventName,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: 'Wasser', price: 2 }],
  });
  // Langer Name: wird in der Zeile gekürzt, darf aber nichts verschieben.
  waiterName = `Maximiliane von Hohenzollern-Sigmaringen ${stamp}`;
  await apiPost(admin.api, `organizations/${admin.organizationId}/waiters/bulk`, admin.headers, {
    eventId: event.id,
    items: [{ name: waiterName, shortName: 'Maxi' }],
  });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

for (const viewport of VIEWPORTS) {
  test(`waiters list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/waiters');

    const row = page.getByTestId('waiters-table').getByRole('row').filter({ hasText: waiterName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Bedienung');
    await expectNoHorizontalOverflow(page);

    // Kopf: nur Symbole, Name als aria-label und Tooltip.
    await expect(page.getByRole('button', { name: 'Mehrere anlegen', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bedienung anlegen', exact: true })).toBeVisible();

    // Veranstaltungsfilter: auf dem Telefon im Sheet hinter dem Filter-Knopf.
    if (viewport.phone) {
      await page.getByRole('button', { name: 'Filter' }).click();
      await page.getByRole('dialog').getByLabel('Gültigkeit filtern').selectOption({ label: `Veranstaltung: ${eventName}` });
      await page.getByRole('button', { name: 'Anwenden' }).click();
    } else {
      await page.getByLabel('Gültigkeit filtern').selectOption({ label: `Veranstaltung: ${eventName}` });
    }
    await expect(row).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await runRowAction(page, row, `${waiterName} bearbeiten`, viewport);
    const form = page.getByRole('dialog', { name: 'Bedienung bearbeiten' });
    await expect(form).toBeVisible();
    await form.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(form).toHaveCount(0);

    // Weitere Aktionen stehen im ⋯-Menü (auf dem Telefon alle).
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    await expect(page.getByRole('menuitem', { name: `${waiterName} löschen`, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    expect(errors()).toEqual([]);
  });
}
