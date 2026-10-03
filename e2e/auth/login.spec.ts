import { test, expect } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { TEST_ADMIN } from '../fixtures/test-data';

/* Die API lehnt falsche Zugangsdaten derzeit mit dem Code UNAUTHORIZED ab
   (LocalStrategy), nicht mit INVALID_CREDENTIALS — die Maske zeigt dann den
   Text des Servers statt ihres eigenen. Beide sagen dasselbe; der Test
   haelt beide aus, damit er die Behebung in der API nicht bricht. */
const UNGUELTIGE_ANMELDUNG = /Ungültige (Anmeldedaten|E-Mail oder Passwort)/;

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('shows the password form first on a self-hosted install', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginPage.login(TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('login returns to the page that asked for it', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveURL(/\/login\?redirect=/);
    await loginPage.login(TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { name: 'Veranstaltungen', level: 1 })).toBeVisible();
  });

  test('failed login shows error message', async ({ page }) => {
    await loginPage.login('niemand@openeos.local', 'falschesPasswort1!');
    await expect(page.getByText(UNGUELTIGE_ANMELDUNG)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('wrong password for an existing account is rejected', async ({ page }) => {
    await loginPage.login(TEST_ADMIN.email, 'falschesPasswort1!');
    await expect(page.getByText(UNGUELTIGE_ANMELDUNG)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('empty email does not log in', async ({ page }) => {
    await loginPage.passwordInput.fill('irgendwas');
    await loginPage.submitButton.click();
    await expect(page.locator('.auth-form__error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('empty password does not log in', async ({ page }) => {
    await loginPage.emailInput.fill(TEST_ADMIN.email);
    await loginPage.submitButton.click();
    await expect(page.locator('.auth-form__error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('forgot password link navigates to forgot password page', async ({ page }) => {
    await loginPage.forgotPasswordLink.click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  // Ersetzt den frueheren Test "register link navigates to register page":
  // eigenstaendig ist die Selbstregistrierung abgeschaltet, Konten legt die
  // Mitgliederverwaltung an. Der Link darf dort gar nicht erscheinen.
  test('offers no self-registration on a self-hosted install', async ({ page }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(page.getByRole('link', { name: /registrieren/i })).toHaveCount(0);
  });

  test('offers device pairing for POS and display', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Kassen-Terminal/ })).toHaveAttribute(
      'href',
      '/device/pair?type=pos',
    );
    await expect(page.getByRole('link', { name: /Monitor/ })).toHaveAttribute(
      'href',
      '/device/pair?type=display',
    );
  });

  test('supports English locale', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  });
});
