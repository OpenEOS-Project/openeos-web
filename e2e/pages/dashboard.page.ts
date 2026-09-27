import { type Locator, type Page } from '@playwright/test';

/**
 * Dashboard mit Seitenleiste (app-shell/app-sidebar.tsx).
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly navigation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.getByRole('complementary');
    this.navigation = this.sidebar.getByRole('navigation');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  navLink(label: string): Locator {
    return this.navigation.getByRole('link', { name: label, exact: true });
  }

  /** Kontomenue unten in der Seitenleiste; der Knopf traegt den Namen. */
  async openUserMenu(fullName: string) {
    await this.sidebar.getByRole('button', { name: new RegExp(`${fullName}$`) }).click();
    return this.page.getByRole('menu');
  }
}
