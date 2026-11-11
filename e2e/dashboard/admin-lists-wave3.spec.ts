import { test, expect } from '../fixtures/auth.fixture';
import { apiPost } from '../fixtures/api';
import { createPosEvent, posAdmin, type PosAdmin } from '../fixtures/pos';
import { VIEWPORTS, expectNoHorizontalOverflow, runRowAction, trackConsoleErrors } from '../fixtures/responsive';

/*
 * Admin-Listen auf DataTable, Welle 3 (Integrationen und Einstellungen):
 * die Standorte der aktiven Veranstaltung in jeder Größe ohne waagerechtes
 * Scrollen, Bearbeiten und Löschen erreichbar (Symbolknopf mit Tooltip bzw.
 * ⋯-Menü auf dem Telefon), keine Konsolenfehler.
 */
test.describe.configure({ mode: 'serial' });

const STATION = 'Küche mit einem sehr langen Namen für die Kürzung in der Liste';
const HANDOFF = 'Ausgabe';
let admin: PosAdmin;

test.beforeAll(async () => {
  admin = await posAdmin();
  // Neue Veranstaltung wird aktiv — die Standorte-Seite zeigt deren Standorte.
  const event = await createPosEvent(admin, {
    name: `Standorte ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: 'Wasser', price: 2 }],
  });
  const handoff = await apiPost(admin.api, `events/${event.id}/production-stations`, admin.headers, {
    name: HANDOFF,
    color: '#2563eb',
  });
  await apiPost(admin.api, `events/${event.id}/production-stations`, admin.headers, {
    name: STATION,
    description: 'Warme Speisen',
    color: '#dc2626',
    handoffStationId: handoff.id,
  });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

for (const viewport of VIEWPORTS) {
  test(`production stations list at ${viewport.width}x${viewport.height}`, async ({ adminPage: page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = trackConsoleErrors(page);
    await page.goto('/production-stations');

    const row = page.getByRole('row').filter({ hasText: STATION });
    await expect(row).toBeVisible();
    // Folge-Standort: auf dem Desktop eigene Spalte, auf dem Telefon in Zeile 2.
    await expect(row).toContainText(HANDOFF);
    await expectNoHorizontalOverflow(page);

    // Kopf: nur ein Symbol, Name als aria-label und Tooltip.
    await expect(page.getByRole('button', { name: 'Standort erstellen' })).toBeVisible();

    await runRowAction(page, row, 'Bearbeiten', viewport);
    const form = page.locator('.modal__panel');
    await expect(form.getByRole('heading', { name: 'Standort bearbeiten' })).toBeVisible();
    await expect(form.getByRole('textbox').first()).toHaveValue(STATION);
    await form.getByRole('button', { name: 'Schließen' }).first().click();
    await expect(form).toHaveCount(0);

    // Löschen fragt nach; abbrechen lässt den Standort stehen.
    await runRowAction(page, row, 'Löschen', viewport);
    const confirm = page.locator('.modal__panel');
    await expect(confirm.getByRole('heading', { name: 'Standort löschen?' })).toBeVisible();
    await confirm.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(row).toBeVisible();

    expect(errors()).toEqual([]);
  });
}
