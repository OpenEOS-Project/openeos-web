import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Login Page
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('E-Mail');
    this.passwordInput = page.getByLabel('Passwort');
    this.submitButton = page.getByRole('button', { name: /anmelden/i });
    this.errorMessage = page.locator('[role="alert"]');
    this.forgotPasswordLink = page.getByRole('link', { name: /passwort vergessen/i });
    this.registerLink = page.getByRole('link', { name: /registrieren/i });
  }

  async goto(locale: string = 'de') {
    await this.page.goto(`/${locale}/login`);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectRedirectToDashboard() {
    await this.page.waitForURL('**/dashboard');
    await expect(this.page).toHaveURL(/.*dashboard/);
  }
}
