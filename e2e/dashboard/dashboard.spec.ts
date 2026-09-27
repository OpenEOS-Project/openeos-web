import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_ADMIN, TEST_ORG, TEST_USER } from '../fixtures/test-data';

const ADMIN_NAME = `${TEST_ADMIN.firstName} ${TEST_ADMIN.lastName}`;

test.describe('Dashboard', () => {
  test.describe('Access Control', () => {
    test('authenticated user sees the dashboard', async ({ adminPage }) => {
      await expect(adminPage.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login\?redirect=/);
    });
  });

  test.describe('Navigation', () => {
    test('admin sees every module in the sidebar', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      for (const label of ['Dashboard', 'Bestellungen', 'Produkte', 'Geräte', 'Mitglieder', 'Veranstaltungen', 'Auswertung']) {
        await expect(dashboard.navLink(label)).toBeVisible();
      }
    });

    // Rechnungen und Support gibt es nur im gehosteten Betrieb.
    test('hides SaaS-only entries on a self-hosted install', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      await expect(dashboard.navLink('Dashboard')).toBeVisible();
      await expect(dashboard.navLink('Rechnungen')).toHaveCount(0);
      await expect(dashboard.navLink('Support')).toHaveCount(0);
      await expect(dashboard.navLink('Organisationen')).toHaveCount(0);
    });

    test('member without module rights sees only the basics', async ({ memberPage }) => {
      const dashboard = new DashboardPage(memberPage);
      await expect(dashboard.navLink('Dashboard')).toBeVisible();
      await expect(dashboard.navLink('Bestellungen')).toBeVisible();
      await expect(dashboard.navLink('Produkte')).toHaveCount(0);
      await expect(dashboard.navLink('Veranstaltungen')).toHaveCount(0);
      await expect(dashboard.navLink('Mitglieder')).toHaveCount(0);
    });

    test('can navigate to events', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      await dashboard.navLink('Veranstaltungen').click();
      await expect(adminPage).toHaveURL(/\/events$/);
      await expect(adminPage.getByRole('heading', { name: 'Veranstaltungen', level: 1 })).toBeVisible();
    });

    test('can navigate to settings via the account menu', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      const menu = await dashboard.openUserMenu(ADMIN_NAME);
      await menu.getByRole('menuitem', { name: 'Einstellungen' }).click();
      await expect(adminPage).toHaveURL(/\/settings$/);
      await expect(adminPage.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    });
  });

  test.describe('Organization', () => {
    test('shows current organization and role', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      await expect(dashboard.sidebar.getByRole('button', { name: new RegExp(`${TEST_ORG.name}\\s+Administrator`) })).toBeVisible();
    });

    test('member sees organization with member role', async ({ memberPage }) => {
      const dashboard = new DashboardPage(memberPage);
      await expect(dashboard.sidebar.getByRole('button', { name: new RegExp(`${TEST_ORG.name}\\s+Mitglied`) })).toBeVisible();
      await expect(dashboard.sidebar.getByRole('button', { name: new RegExp(`${TEST_USER.firstName} ${TEST_USER.lastName}$`) })).toBeVisible();
    });
  });

  test.describe('User Menu', () => {
    test('can logout', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      const menu = await dashboard.openUserMenu(ADMIN_NAME);
      await menu.getByRole('menuitem', { name: 'Abmelden' }).click();
      await expect(adminPage).toHaveURL(/\/login/);

      // Abgemeldet heisst auch: die Sitzung ist serverseitig beendet und
      // laesst sich nicht aus dem Cookie wiederherstellen.
      await adminPage.goto('/dashboard');
      await expect(adminPage).toHaveURL(/\/login\?redirect=/);
    });
  });

  test.describe('Theme', () => {
    test('can switch between dark and light mode', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      const html = adminPage.locator('html');

      let menu = await dashboard.openUserMenu(ADMIN_NAME);
      await menu.getByRole('menuitem', { name: 'Dunkel' }).click();
      await expect(html).toHaveClass(/\bdark-mode\b/);

      menu = await dashboard.openUserMenu(ADMIN_NAME);
      await menu.getByRole('menuitem', { name: 'Hell' }).click();
      await expect(html).toHaveClass(/\blight-mode\b/);
      await expect(html).not.toHaveClass(/\bdark-mode\b/);
    });
  });

  test.describe('Responsive Design', () => {
    test('sidebar is off-canvas on mobile and opens on demand', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      await adminPage.setViewportSize({ width: 375, height: 667 });
      await dashboard.goto();

      const productsLink = dashboard.navLink('Produkte');
      await expect(productsLink).not.toBeInViewport();

      await adminPage.getByRole('button', { name: 'Navigation öffnen' }).click();
      await expect(productsLink).toBeInViewport();
      await productsLink.click();
      await expect(adminPage).toHaveURL(/\/products$/);
      // Nach dem Wechsel schliesst sich die Leiste wieder.
      await expect(productsLink).not.toBeInViewport();
    });
  });
});
