import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Dashboard Page
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly userMenu: Locator;
  readonly organizationSelector: Locator;
  readonly creditsDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('aside');
    this.userMenu = page.getByRole('button', { name: /profil|benutzer/i });
    this.organizationSelector = page.locator('[data-testid="org-selector"]');
    this.creditsDisplay = page.locator('text=/\\d+\\s*credits?/i');
  }

  async goto(locale: string = 'de') {
    await this.page.goto(`/${locale}/dashboard`);
  }

  async navigateTo(menuItem: string) {
    await this.page.getByRole('link', { name: new RegExp(menuItem, 'i') }).click();
  }

  async logout() {
    await this.userMenu.click();
    await this.page.getByRole('menuitem', { name: /abmelden|logout/i }).click();
  }

  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/.*dashboard/);
  }

  async expectCredits(amount: number) {
    await expect(this.page.getByText(`${amount} Credits`)).toBeVisible();
  }
}
