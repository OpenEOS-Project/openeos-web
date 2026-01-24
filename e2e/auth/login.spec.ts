import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { TEST_USER } from '../fixtures/test-data';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('shows login form', async ({ page }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await loginPage.expectRedirectToDashboard();
  });

  test('failed login shows error message', async ({ page }) => {
    await loginPage.login('wrong@email.com', 'wrongpassword');
    await loginPage.expectError();
  });

  test('empty email shows validation error', async ({ page }) => {
    await loginPage.passwordInput.fill('somepassword');
    await loginPage.submitButton.click();

    // Form should not submit, still on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('empty password shows validation error', async ({ page }) => {
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.submitButton.click();

    // Form should not submit, still on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('forgot password link navigates to forgot password page', async ({ page }) => {
    await loginPage.forgotPasswordLink.click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });

  test('register link navigates to register page', async ({ page }) => {
    await loginPage.registerLink.click();
    await expect(page).toHaveURL(/.*register/);
  });

  test('supports German locale', async ({ page }) => {
    await page.goto('/de/login');
    await expect(page.getByRole('button', { name: /anmelden/i })).toBeVisible();
  });

  test('supports English locale', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });
});
