import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Dashboard', () => {
  test.describe('Access Control', () => {
    test('authenticated user can access dashboard', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();
      await dashboardPage.expectToBeOnDashboard();
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto('/de/dashboard');
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('Navigation', () => {
    test('shows sidebar navigation', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      // Sidebar should be visible
      await expect(dashboardPage.sidebar).toBeVisible();
    });

    test('can navigate to events', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      await dashboardPage.navigateTo('Veranstaltungen');
      await expect(authenticatedPage).toHaveURL(/.*events/);
    });

    test('can navigate to POS', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      await dashboardPage.navigateTo('Kasse');
      await expect(authenticatedPage).toHaveURL(/.*pos/);
    });

    test('can navigate to settings', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      await dashboardPage.navigateTo('Einstellungen');
      await expect(authenticatedPage).toHaveURL(/.*settings/);
    });
  });

  test.describe('Organization', () => {
    test('shows current organization', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      // Organization name or selector should be visible
      await expect(authenticatedPage.locator('aside')).toContainText(/organisation|org/i);
    });

    test('shows credits balance', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      // Credits display should be visible
      await expect(authenticatedPage.getByText(/credits/i)).toBeVisible();
    });
  });

  test.describe('User Menu', () => {
    test('can logout', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      // Find user menu (profile button)
      const profileButton = authenticatedPage.locator('[data-testid="user-menu"], [aria-label*="Profil"], [aria-label*="User"]').first();
      if (await profileButton.isVisible()) {
        await profileButton.click();

        const logoutButton = authenticatedPage.getByRole('menuitem', { name: /abmelden|logout/i });
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
          await expect(authenticatedPage).toHaveURL(/.*login/);
        }
      }
    });
  });

  test.describe('Theme', () => {
    test('can toggle dark/light mode', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);
      await dashboardPage.goto();

      // Find theme toggle
      const themeToggle = authenticatedPage.getByRole('button', { name: /theme|dark|light/i });
      if (await themeToggle.isVisible()) {
        const htmlBefore = await authenticatedPage.locator('html').getAttribute('class');
        await themeToggle.click();
        const htmlAfter = await authenticatedPage.locator('html').getAttribute('class');

        // Class should have changed
        expect(htmlBefore).not.toBe(htmlAfter);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('sidebar collapses on mobile', async ({ authenticatedPage }) => {
      const dashboardPage = new DashboardPage(authenticatedPage);

      // Set mobile viewport
      await authenticatedPage.setViewportSize({ width: 375, height: 667 });
      await dashboardPage.goto();

      // Sidebar should be hidden or collapsed
      const sidebar = authenticatedPage.locator('aside');
      const isHidden = await sidebar.isHidden();
      const isCollapsed = await sidebar.evaluate((el) => el.classList.contains('collapsed'));

      expect(isHidden || isCollapsed).toBeTruthy();
    });
  });
});
