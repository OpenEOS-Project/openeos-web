import { test as base, Page } from '@playwright/test';
import { TEST_USER, TEST_ADMIN } from './test-data';

/**
 * Extended test fixtures with authentication
 */
type AuthFixtures = {
  /** Page with logged-in regular user */
  authenticatedPage: Page;
  /** Page with logged-in super admin */
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login as regular user
    await page.goto('/de/login');
    await page.getByLabel('E-Mail').fill(TEST_USER.email);
    await page.getByLabel('Passwort').fill(TEST_USER.password);
    await page.getByRole('button', { name: /anmelden/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await use(page);
  },

  adminPage: async ({ page }, use) => {
    // Login as super admin
    await page.goto('/de/login');
    await page.getByLabel('E-Mail').fill(TEST_ADMIN.email);
    await page.getByLabel('Passwort').fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: /anmelden/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
