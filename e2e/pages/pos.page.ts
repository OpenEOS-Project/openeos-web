import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for POS (Point of Sale) Page
 */
export class POSPage {
  readonly page: Page;
  readonly categoryTabs: Locator;
  readonly productGrid: Locator;
  readonly cart: Locator;
  readonly cartItems: Locator;
  readonly cartTotal: Locator;
  readonly checkoutButton: Locator;
  readonly clearCartButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryTabs = page.locator('[data-testid="category-tabs"]');
    this.productGrid = page.locator('[data-testid="product-grid"]');
    this.cart = page.locator('[data-testid="cart"]');
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.cartTotal = page.locator('[data-testid="cart-total"]');
    this.checkoutButton = page.getByRole('button', { name: /bezahlen|checkout/i });
    this.clearCartButton = page.getByRole('button', { name: /leeren|clear/i });
  }

  async goto(locale: string = 'de') {
    await this.page.goto(`/${locale}/pos`);
  }

  async selectCategory(categoryName: string) {
    await this.page.getByRole('tab', { name: categoryName }).click();
  }

  async addProductToCart(productName: string) {
    await this.page.getByText(productName).click();
  }

  async increaseQuantity(productName: string) {
    const cartItem = this.page.locator('[data-testid="cart-item"]').filter({ hasText: productName });
    await cartItem.getByRole('button', { name: '+' }).click();
  }

  async decreaseQuantity(productName: string) {
    const cartItem = this.page.locator('[data-testid="cart-item"]').filter({ hasText: productName });
    await cartItem.getByRole('button', { name: '-' }).click();
  }

  async removeFromCart(productName: string) {
    const cartItem = this.page.locator('[data-testid="cart-item"]').filter({ hasText: productName });
    await cartItem.getByRole('button', { name: /entfernen|remove/i }).click();
  }

  async clearCart() {
    await this.clearCartButton.click();
  }

  async checkout() {
    await this.checkoutButton.click();
  }

  async payWithCash() {
    await this.page.getByRole('button', { name: /bar|cash/i }).click();
  }

  async payWithCard() {
    await this.page.getByRole('button', { name: /karte|card/i }).click();
  }

  async expectProductInCart(productName: string) {
    await expect(this.page.locator('[data-testid="cart-item"]').filter({ hasText: productName })).toBeVisible();
  }

  async expectCartEmpty() {
    await expect(this.cartItems).toHaveCount(0);
  }

  async expectTotal(amount: string) {
    await expect(this.cartTotal).toContainText(amount);
  }

  async expectOrderSuccess() {
    await expect(this.page.getByText(/bestellung.*erfolgreich|order.*success/i)).toBeVisible();
  }
}
