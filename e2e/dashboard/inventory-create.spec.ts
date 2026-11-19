import { test, expect } from '../fixtures/auth.fixture';
import { type PosAdmin, createPosEvent, posAdmin } from '../fixtures/pos';

/*
 * Inventur anlegen: Ohne Produkte mit „Bestand verfolgen“ gibt es nichts zu
 * zählen — der Dialog bietet „Erstellen & Starten“ dann gar nicht an und
 * verweist auf die Produkte. Scheitert der Start trotzdem, zeigt der Dialog
 * den Grund der API und lässt keinen verwaisten Entwurf zurück.
 */
test.describe.configure({ mode: 'serial' });

let admin: PosAdmin;

test.beforeAll(async () => {
  admin = await posAdmin();
});

test.afterAll(async () => {
  await admin.api.dispose();
});

async function listCounts(eventId: string) {
  const res = await admin.api.get(`events/${eventId}/inventory/counts`, { headers: admin.headers });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: unknown[] | { data?: unknown[]; items?: unknown[] } };
  const data = body.data;
  return Array.isArray(data) ? data : (data.data ?? data.items ?? []);
}

async function openCreateDialog(page: import('@playwright/test').Page) {
  await page.goto('/inventory');
  await page.getByRole('button', { name: 'Inventur erstellen' }).first().click();
  await expect(page.getByRole('heading', { name: 'Inventur erstellen' })).toBeVisible();
}

test.describe('Inventory - create and start', () => {
  test('without tracked products the dialog explains why it cannot start', async ({ adminPage }) => {
    const event = await createPosEvent(admin, {
      name: `Inventur ohne Bestand ${Date.now()}`,
      tables: { mode: 'none' },
      orderingMode: 'immediate',
      products: [{ name: 'Apfelschorle', price: 3.5 }],
    });

    await openCreateDialog(adminPage);
    const hint = adminPage.getByTestId('inventory-no-tracked-products');
    await expect(hint).toContainText('„Bestand verfolgen“');
    await expect(hint.getByRole('link', { name: 'Zu den Produkten' })).toHaveAttribute('href', /\/products$/);
    await expect(adminPage.getByRole('button', { name: 'Erstellen & Starten' })).toBeDisabled();
    expect(await listCounts(event.id)).toHaveLength(0);
  });

  test('a failed start shows the reason and removes the draft again', async ({ adminPage }) => {
    const event = await createPosEvent(admin, {
      name: `Inventur Startfehler ${Date.now()}`,
      tables: { mode: 'none' },
      orderingMode: 'immediate',
      products: [{ name: 'Wasser', price: 2, trackInventory: true, stockQuantity: 10 }],
    });
    await adminPage.route('**/api/events/*/inventory/counts/*/start', (route) =>
      route.fulfill({
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_ERROR',
            reason: 'INVENTORY_EMPTY',
            message: 'Inventur hat keine Artikel zum Zählen',
          },
        },
      })
    );

    await openCreateDialog(adminPage);
    await expect(adminPage.getByText('1 Produkte mit Bestandsverfolgung')).toBeVisible();
    const deleted = adminPage.waitForResponse(
      (res) => res.request().method() === 'DELETE' && /\/inventory\/counts\/[^/]+$/.test(res.url())
    );
    await adminPage.getByRole('button', { name: 'Erstellen & Starten' }).click();
    await expect(adminPage.locator('.modal__panel').getByRole('alert')).toHaveText('Die Inventur enthält keine Artikel zum Zählen.');
    expect((await deleted).ok()).toBeTruthy();
    // Der Dialog bleibt offen, der Entwurf ist wieder weg.
    await expect(adminPage.getByRole('button', { name: 'Erstellen & Starten' })).toBeEnabled();
    expect(await listCounts(event.id)).toHaveLength(0);
  });
});
