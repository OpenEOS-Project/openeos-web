import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/de/forgot-password');
  });

  test('shows forgot password form', async ({ page }) => {
    await expect(page.getByText('Passwort vergessen')).toBeVisible();
    await expect(page.getByLabel('E-Mail')).toBeVisible();
    await expect(page.getByRole('button', { name: /link senden/i })).toBeVisible();
  });

  test('shows success message after submitting email', async ({ page }) => {
    await page.getByLabel('E-Mail').fill('test@example.com');
    await page.getByRole('button', { name: /link senden/i }).click();

    // Should show success state (even if email doesn't exist - security)
    await expect(page.getByText(/e-mail gesendet/i)).toBeVisible();
  });

  test('back to login link works', async ({ page }) => {
    await page.getByRole('link', { name: /zurück zur anmeldung/i }).click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('validates email format', async ({ page }) => {
    await page.getByLabel('E-Mail').fill('invalid-email');
    await page.getByRole('button', { name: /link senden/i }).click();

    // Should still be on forgot-password page
    await expect(page).toHaveURL(/.*forgot-password/);
  });

  test('supports English locale', async ({ page }) => {
    await page.goto('/en/forgot-password');
    await expect(page.getByText('Forgot password')).toBeVisible();
    await expect(page.getByRole('button', { name: /send link/i })).toBeVisible();
  });
});

test.describe('Reset Password', () => {
  test('shows invalid token message when no token', async ({ page }) => {
    await page.goto('/de/reset-password');
    await expect(page.getByText(/link ungültig/i)).toBeVisible();
  });

  test('shows reset form when token is provided', async ({ page }) => {
    await page.goto('/de/reset-password?token=test-token');
    await expect(page.getByText('Neues Passwort setzen')).toBeVisible();
    await expect(page.getByLabel('Neues Passwort')).toBeVisible();
    await expect(page.getByLabel('Passwort bestätigen')).toBeVisible();
  });

  test('validates password confirmation', async ({ page }) => {
    await page.goto('/de/reset-password?token=test-token');

    await page.getByLabel('Neues Passwort').fill('password123');
    await page.getByLabel('Passwort bestätigen').fill('different123');
    await page.getByRole('button', { name: /passwort ändern/i }).click();

    // Should show validation error or still be on page
    await expect(page).toHaveURL(/.*reset-password/);
  });

  test('request new link button navigates to forgot password', async ({ page }) => {
    await page.goto('/de/reset-password');
    await page.getByRole('button', { name: /neuen link anfordern/i }).click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });
});
