import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Kasse eines gekoppelten Geraets (/device/pos).
 *
 * Die Kasse ist keine Seite im Dashboard: sie laeuft auf einem Tablet,
 * das per Code gekoppelt wurde, und meldet sich mit einem Geraete-Token an
 * statt mit einem Benutzerkonto.
 */
export class POSPage {
  readonly page: Page;
  /** Warenkorb-Spalte rechts (auf breiten Bildschirmen immer sichtbar). */
  readonly cart: Locator;
  readonly payCashButton: Locator;
  readonly clearCartButton: Locator;
  readonly cashDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cart = page.locator('.pos-cart-col');
    this.payCashButton = this.cart.getByRole('button', { name: 'Bar', exact: true });
    this.clearCartButton = this.cart.getByRole('button', { name: 'Warenkorb leeren' });
    this.cashDialog = page.getByRole('dialog', { name: 'Barzahlung' });
  }

  async goto() {
    await this.page.goto('/device/pos');
  }

  /** Tischnummer ueber das Ziffernfeld eingeben und die Bestellung beginnen. */
  async startTable(number: string) {
    await expect(this.page.getByRole('heading', { name: 'Tischnummer eingeben' })).toBeVisible();
    for (const digit of number) {
      await this.page.getByRole('button', { name: digit, exact: true }).click();
    }
    await this.page.getByRole('button', { name: 'Bestellung starten' }).click();
    await expect(this.page.getByRole('button', { name: `Tisch ${number} ▾` })).toBeVisible();
  }

  product(name: string): Locator {
    return this.page.getByRole('main').getByRole('button', { name: new RegExp(`^${name} `) });
  }

  async addProduct(name: string) {
    await this.product(name).click();
  }

  /** Menge und Name stehen in getrennten Elementen ("2×", "Apfelschorle"). */
  async expectCartLine(name: string, quantity: number) {
    await expect(this.cart).toContainText(new RegExp(`(^|\\D)${quantity}×\\s*${name}`));
  }

  /** Betrag wie angezeigt, etwa "9,00" — das Euro-Zeichen steht mit geschuetztem Leerzeichen dahinter. */
  async expectTotal(amount: string) {
    await expect(this.cart).toContainText(new RegExp(`Gesamt\\s*${amount}\\s€`));
  }
}
