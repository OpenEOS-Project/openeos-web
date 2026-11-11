import { test, expect } from '../fixtures/auth.fixture';
import { apiPost } from '../fixtures/api';
import { createPosEvent, posAdmin } from '../fixtures/pos';

/*
 * Kategorie löschen: Die API löscht nur leere Kategorien
 * (CATEGORY_HAS_PRODUCTS). Früher versprach der Dialog, die Produkte
 * wanderten in eine Standardkategorie, und scheiterte dann. Jetzt nennt er
 * die Zahl der Produkte und führt zu ihnen; leere Kategorien gehen weg.
 */
test.describe('Kategorie löschen', () => {
  test('a category with products links to them, an empty one is deleted', async ({ adminPage: page }) => {
    const admin = await posAdmin();
    const event = await createPosEvent(admin, {
      name: `Kategorien ${Date.now() % 100000}`,
      tables: { mode: 'none' },
      orderingMode: 'immediate',
      products: [{ name: 'Apfelschorle', price: 3.5 }],
    });
    await apiPost(admin.api, `events/${event.id}/categories`, admin.headers, { name: 'Leere Kategorie' });

    await page.goto('/products');
    await page.getByRole('button', { name: 'Kategorien bearbeiten' }).click();

    const row = (name: string) => page.locator('.cat-row').filter({ hasText: name });
    await row('Getränke').getByRole('button', { name: 'Löschen' }).click();

    const dialog = page.getByTestId('category-delete-dialog');
    await expect(dialog).toContainText('In „Getränke“ ist noch ein Produkt.');
    await expect(dialog.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Produkt dieser Kategorie anzeigen' }).click();

    await expect(page).toHaveURL(/\/products\?category=/);
    await expect(page.getByTestId('products-category-filter')).toContainText('Kategorie: Getränke');
    await expect(page.getByText('Apfelschorle', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Kategorien bearbeiten' }).click();
    await row('Leere Kategorie').getByRole('button', { name: 'Löschen' }).click();
    await expect(dialog).toContainText('wird endgültig gelöscht');
    await dialog.getByRole('button', { name: 'Löschen' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row('Leere Kategorie')).toHaveCount(0);
  });
});
