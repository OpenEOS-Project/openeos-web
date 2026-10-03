import type { APIRequestContext } from '@playwright/test';

import { test, expect, loginAs } from '../fixtures/auth.fixture';
import { apiLogin, ensureOk, newApiContext } from '../fixtures/api';
import { TEST_ADMIN, TEST_USER } from '../fixtures/test-data';
import { DashboardPage } from '../pages/dashboard.page';

/**
 * Integrationen: Katalog mit Infofenster, Schalter, Eintrag in der
 * Seitenleiste und eigene Konfigurationsseite.
 *
 * Der Schalter-Endpunkt (PATCH /organizations/:id/integrations/:integrationId)
 * kommt mit einem eigenen PR in die API. Bis der in dev ist, läuft die CI
 * gegen ein Image ohne ihn — dann werden diese Tests mit Begründung
 * übersprungen statt rot zu werden. Ein 404 mit INTEGRATION_NOT_FOUND wäre
 * dagegen ein echter Fehler (die API kennt SumUp nicht) und schlägt fehl.
 */

let api: APIRequestContext;
let headers: Record<string, string>;
let organizationId: string;
let endpointAvailable = true;

async function setSumup(enabled: boolean) {
  return api.patch(`organizations/${organizationId}/integrations/sumup`, {
    headers,
    data: { enabled },
  });
}

test.beforeAll(async () => {
  api = await newApiContext();
  const login = await apiLogin(api, TEST_ADMIN.email, TEST_ADMIN.password);
  headers = login.headers;
  organizationId = login.organizationId!;

  // Zugleich Ausgangszustand: SumUp aus.
  const res = await setSumup(false);
  if (res.status() === 404) {
    const body = await res.json().catch(() => ({}));
    const code = body?.code ?? body?.error?.code;
    if (code !== 'INTEGRATION_NOT_FOUND') {
      endpointAvailable = false;
      return;
    }
  }
  await ensureOk(res, 'SumUp ausschalten');
});

test.afterAll(async () => {
  if (endpointAvailable) await setSumup(false);
  await api.dispose();
});

const SKIP_REASON =
  'Die API kennt PATCH /organizations/:id/integrations/:integrationId noch nicht (404) — ' +
  'der Test läuft, sobald der API-PR zur Integrations-Aktivierung in dev ist.';

test.describe('Integrations', () => {
  test('admin activates SumUp in the catalog, configures it and deactivates it', async ({ adminPage }) => {
    test.skip(!endpointAvailable, SKIP_REASON);
    const dashboard = new DashboardPage(adminPage);

    await adminPage.goto('/integrations');
    await expect(adminPage.getByRole('heading', { name: 'Integrationen', level: 1 })).toBeVisible();
    await expect(dashboard.navLink('SumUp')).toHaveCount(0);

    // Die ganze Karte ist der Knopf; ihr Name beginnt mit dem Markennamen.
    await adminPage.getByRole('button', { name: /^SumUp/ }).click();

    const dialog = adminPage.getByRole('dialog', { name: 'SumUp' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Zur Dokumentation' })).toHaveAttribute(
      'href',
      'https://docs.openeos.de/integrationen/sumup',
    );
    await expect(dialog.getByRole('button', { name: 'Nächstes Bild' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Aktivieren', exact: true }).click();
    await expect(dialog.getByText('Beim Deaktivieren bleiben Ihre Einstellungen erhalten.')).toBeVisible();
    await expect(dashboard.navLink('SumUp')).toBeVisible();

    // Escape schließt das Fenster.
    await adminPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await dashboard.navLink('SumUp').click();
    await expect(adminPage).toHaveURL(/\/integrations\/sumup$/);
    await expect(adminPage.getByRole('heading', { name: 'SumUp', level: 1 })).toBeVisible();

    await adminPage.getByRole('button', { name: 'Deaktivieren', exact: true }).click();
    const confirm = adminPage.getByRole('dialog', { name: 'SumUp deaktivieren?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Deaktivieren', exact: true }).click();

    await expect(adminPage).toHaveURL(/\/integrations$/);
    await expect(dashboard.navLink('SumUp')).toHaveCount(0);
  });

  test('member visiting an integration page directly is sent back to the catalog', async ({ page }) => {
    test.skip(!endpointAvailable, SKIP_REASON);
    // Erst einschalten, dann anmelden: so lädt die Sitzung den aktiven
    // Stand, und die Umleitung kann nur noch an der fehlenden Admin-Rolle
    // liegen.
    await ensureOk(await setSumup(true), 'SumUp einschalten');
    await loginAs(page, TEST_USER);

    await page.goto('/integrations/sumup');
    await expect(page).toHaveURL(/\/integrations$/);
    await expect(new DashboardPage(page).navLink('SumUp')).toHaveCount(0);
  });
});
