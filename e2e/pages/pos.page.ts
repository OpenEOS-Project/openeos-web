import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Kasse eines gekoppelten Geraets (/device/pos).
 *
 * Die Kasse ist keine Seite im Dashboard: sie laeuft auf einem Tablet,
 * das per Code gekoppelt wurde, und meldet sich mit einem Geraete-Token an
 * statt mit einem Benutzerkonto.
 *
 * Alles ueber zugaengliche Namen, keine Symbole. Auf schmalen Geraeten
 * (bis 820 px) liegt der Warenkorb in einem Blatt hinter der Leiste unten;
 * die Methoden oeffnen es bei Bedarf selbst.
 */
export class POSPage {
  readonly page: Page;
  readonly startView: Locator;
  readonly tablePill: Locator;
  /** Warenkorb (Spalte rechts bzw. Blatt von unten). */
  readonly cart: Locator;
  /** Leiste unten auf schmalen Geraeten. */
  readonly cartBar: Locator;
  readonly checkoutButton: Locator;
  readonly sendButton: Locator;
  readonly clearCartButton: Locator;
  readonly paySheet: Locator;
  readonly doneSheet: Locator;
  readonly moreButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startView = page.getByRole('heading', { name: 'Tisch öffnen' });
    this.tablePill = page.getByRole('button', { name: /^Tisch .* – Tisch wechseln$/ });
    this.cart = page.getByRole('complementary', { name: 'Warenkorb' });
    this.cartBar = page.getByRole('button', { name: /^Warenkorb öffnen/ });
    this.checkoutButton = this.cart.getByRole('button', { name: 'Kassieren', exact: true });
    this.sendButton = this.cart.getByRole('button', { name: 'Senden', exact: true });
    this.clearCartButton = this.cart.getByRole('button', { name: 'Warenkorb leeren' });
    this.paySheet = page.getByRole('dialog', { name: /^Kassieren/ });
    this.doneSheet = page.getByRole('dialog', { name: 'Bezahlt' });
    this.moreButton = page.getByRole('button', { name: 'Weitere Aktionen' });
  }

  get isCompact(): boolean {
    return (this.page.viewportSize()?.width ?? 1280) <= 820;
  }

  async goto() {
    await this.page.goto('/device/pos');
  }

  /** Tischnummer ueber den Ziffernblock der Startansicht eingeben und oeffnen. */
  async openTableByNumber(number: string) {
    await expect(this.startView).toBeVisible();
    for (const key of number) {
      await this.page.getByRole('button', { name: key, exact: true }).click();
    }
    await this.page.getByRole('button', { name: `Tisch ${number} öffnen` }).click();
    await expect(this.page.getByRole('button', { name: `Tisch ${number} – Tisch wechseln` })).toBeVisible();
  }

  /** Zurueck zur Startansicht ueber die Tisch-Pille. */
  async switchTable() {
    await this.tablePill.click();
    await expect(this.startView).toBeVisible();
  }

  product(name: string): Locator {
    return this.page.getByRole('main').getByRole('button', { name: new RegExp(`^${name}\\b`) });
  }

  async addProduct(name: string) {
    await this.product(name).click();
  }

  /** Auf schmalen Geraeten das Warenkorb-Blatt oeffnen. */
  /** Offen heisst: Klasse is-open — die Sichtbarkeit haengt beim Schliessen
   *  noch die Dauer der Animation nach. */
  private async isCartOpen() {
    // Geschlossen ist das Blatt unsichtbar und damit nicht per Rolle auffindbar.
    return /\bis-open\b/.test((await this.page.locator('aside.pos-cart').getAttribute('class')) ?? '');
  }

  async openCart() {
    if (!this.isCompact) return;
    if (await this.isCartOpen()) return;
    await this.cartBar.click();
    await expect(this.cart).toBeVisible();
  }

  async closeCart() {
    if (!this.isCompact) return;
    if (!(await this.isCartOpen())) return;
    await this.cart.getByRole('button', { name: 'Warenkorb schließen' }).click();
    await expect(this.cart).toBeHidden();
  }

  cartLine(name: string): Locator {
    return this.cart.getByRole('listitem').filter({ hasText: name });
  }

  /** Menge steht im Stepper der Zeile. */
  async expectCartLine(name: string, quantity: number) {
    await this.openCart();
    await expect(this.cartLine(name).locator('.oe-stepper__val')).toHaveText(String(quantity));
  }

  /** Betrag wie angezeigt, etwa "9,00" — das Euro-Zeichen steht mit geschuetztem Leerzeichen dahinter. */
  async expectTotal(amount: string) {
    await this.openCart();
    await expect(this.cart).toContainText(new RegExp(`Gesamt\\s*${amount}\\s€`));
  }

  async send() {
    await this.openCart();
    await this.sendButton.click();
  }

  /** „Kassieren“ oeffnet das Kassieren-Blatt. */
  async checkout() {
    await this.openCart();
    await this.checkoutButton.click();
    await expect(this.paySheet).toBeVisible();
  }

  /** Bar: Schnellwahl („Passend“ oder ein Betrag wie „20,00 €“). */
  async payCash(quick: string = 'Passend') {
    await this.paySheet.getByRole('radio', { name: 'Bar' }).click();
    await this.paySheet.getByRole('button', { name: quick, exact: true }).click();
  }

  async completePayment() {
    await this.paySheet.getByRole('button', { name: /Zahlung abschließen|Ohne Zahlung abschließen/ }).click();
    await expect(this.doneSheet).toBeVisible();
  }

  async nextReceipt() {
    await this.doneSheet.getByRole('button', { name: 'Nächster Bon' }).click();
    await expect(this.doneSheet).toHaveCount(0);
  }

  async openMenu(item: string) {
    await this.moreButton.click();
    await this.page.getByRole('menuitem', { name: item }).click();
  }

  /** Benutzer-Chip: Kasse sperren (nur mit Geraete-PIN sichtbar). */
  async lock() {
    await this.page.getByRole('button', { name: 'Kasse sperren' }).click();
  }
}
