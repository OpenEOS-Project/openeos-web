import { type Locator, type Page } from '@playwright/test';

/**
 * Anmeldemaske.
 *
 * Eigenstaendig startet sie beim Passwort (ohne Mailserver kaeme ein
 * Anmeldelink nie an); gehostet beim Anmeldelink. Diese Suite laeuft gegen
 * eine eigenstaendige Installation.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('E-Mail-Adresse');
    this.passwordInput = page.getByLabel('Passwort', { exact: true });
    this.submitButton = page.getByRole('button', { name: 'Anmelden', exact: true });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Passwort vergessen?' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
