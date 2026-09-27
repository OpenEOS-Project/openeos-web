import { test as base, expect, type Page } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { TEST_ADMIN, TEST_USER } from './test-data';

/**
 * Seiten mit angemeldetem Konto.
 *
 * Angemeldet wird ueber die echte Maske und nicht per gespeichertem
 * Zustand: das Zugriffstoken lebt nur im Speicher der Seite (siehe
 * setAccessToken im API-Client), ein storageState truege also nichts
 * Brauchbares mit. Die Anmeldung selbst ist zudem der Weg, den jede Sitzung
 * nimmt — kaputt ginge dort zuerst alles.
 */
type AuthFixtures = {
  /** Administrator der Organisation (aus der Ersteinrichtung). */
  adminPage: Page;
  /** Mitglied ohne Modulrechte. */
  memberPage: Page;
};

export async function loginAs(page: Page, user: { email: string; password: string }) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  // Erst wenn die Seitenleiste steht, sind Konto und Organisation geladen —
  // vorher klickte ein Test mitunter ins Leere.
  await expect(page.getByRole('complementary').getByRole('navigation')).toBeVisible();
}

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ page }, use) => {
    await loginAs(page, TEST_ADMIN);
    await use(page);
  },
  memberPage: async ({ page }, use) => {
    await loginAs(page, TEST_USER);
    await use(page);
  },
});

export { expect };
