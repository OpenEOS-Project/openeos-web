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
  /** Seitenleiste „Offene Tische“ der Startansicht. */
  readonly openTablesAside: Locator;
  /** Blatt „Tisch wählen“ (Tisch-Pille). */
  readonly tableSheet: Locator;

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
    this.openTablesAside = page.getByRole('complementary', { name: 'Offene Tische' });
    this.tableSheet = page.getByRole('dialog', { name: 'Tisch wählen' });
  }

  get isCompact(): boolean {
    return (this.page.viewportSize()?.width ?? 1280) <= 820;
  }

  async goto() {
    await this.page.goto('/device/pos');
  }

  /** Tisch-Pille eines geoeffneten Tisches. */
  pill(label: string): Locator {
    return this.page.getByRole('button', { name: `Tisch ${label} – Tisch wechseln` });
  }

  /** Ziffern ueber den Ziffernblock der Startansicht tippen. */
  async typeNumber(number: string) {
    await expect(this.startView).toBeVisible();
    for (const key of number) {
      await this.page.getByRole('button', { name: key, exact: true }).click();
    }
  }

  /**
   * Tischnummer eingeben und oeffnen. Bei vordefinierten Tischen kann die
   * Bezeichnung von der Eingabe abweichen („3“ oeffnet „A03“).
   */
  async openTableByNumber(number: string, label: string = number) {
    await this.typeNumber(number);
    await this.page.getByRole('button', { name: `Tisch ${label} öffnen` }).click();
    await expect(this.pill(label)).toBeVisible();
  }

  /** Startansicht „Tische“: Tisch in der Liste antippen. */
  async openTableFromList(label: string) {
    await expect(this.startView).toBeVisible();
    const segment = this.page.getByRole('button', { name: 'Tische', exact: true });
    if ((await segment.getAttribute('aria-pressed')) !== 'true') await segment.click();
    await this.tableChip(label).click();
    await expect(this.pill(label)).toBeVisible();
  }

  /**
   * Tisch-Chip der Tischliste — zugaenglicher Name „Tisch A03, frei“. Die
   * Zeilen in „Offene Tische“ beginnen genauso, daher auf die Liste begrenzt.
   */
  tableChip(label: string): Locator {
    return this.page.locator('.pos-tablelist').getByRole('button', { name: new RegExp(`^Tisch ${label}, `) });
  }

  /** Tisch auf der Karte — zugaenglicher Name „Tisch A03, frei“. */
  floorTable(label: string, scope: Locator | Page = this.page): Locator {
    return scope.locator('.pos-floor').getByRole('button', { name: new RegExp(`^Tisch ${label}, `) });
  }

  /** Startansicht „Karte“: Tisch auf dem Tischplan antippen. */
  async openTableOnMap(label: string) {
    await expect(this.startView).toBeVisible();
    const segment = this.page.getByRole('button', { name: 'Karte', exact: true });
    if ((await segment.getAttribute('aria-pressed')) !== 'true') await segment.click();
    await this.floorTable(label).click();
    await expect(this.pill(label)).toBeVisible();
  }

  /** „Ohne Tisch“ auf der Startansicht: Theke oder To-go. */
  async withoutTable(kind: 'Theke' | 'To-go') {
    await expect(this.startView).toBeVisible();
    await this.page.getByRole('button', { name: kind, exact: true }).click();
    await expect(this.page.getByRole('button', { name: `${kind} – Tisch wählen` })).toBeVisible();
  }

  /** Blatt „Tisch wählen“ ueber die Pille oeffnen. */
  async openTableSheet() {
    await this.page.getByRole('button', { name: /– Tisch (wechseln|wählen)$/ }).click();
    await expect(this.tableSheet).toBeVisible();
  }

  /**
   * Tisch wechseln ueber die Pille: vordefiniert per Chip, frei per
   * Ziffernblock im Blatt. Der Warenkorb wird geparkt.
   */
  async switchTable(label: string, { byNumber = false }: { byNumber?: boolean } = {}) {
    await this.openTableSheet();
    if (byNumber) {
      for (const key of label) await this.tableSheet.getByRole('button', { name: key, exact: true }).click();
      await this.tableSheet.getByRole('button', { name: `Tisch ${label} öffnen` }).click();
    } else {
      await this.tableSheet.getByRole('button', { name: new RegExp(`^Tisch ${label}, `) }).click();
    }
    await expect(this.pill(label)).toBeVisible();
  }

  /** Zurueck zur Startansicht (Blatt „Tisch wählen“ → „Zur Tischübersicht“). */
  async backToStart() {
    await this.openTableSheet();
    await this.tableSheet.getByRole('button', { name: 'Zur Tischübersicht' }).click();
    await expect(this.startView).toBeVisible();
  }

  openTableRow(title: string): Locator {
    return this.openTablesAside.getByRole('button', { name: new RegExp(`^${title},`) });
  }

  /** „Offene Tische“ zeigt den Tisch mit Betrag, etwa "3,50". */
  async expectOpenTable(label: string, amount: string) {
    await expect(this.openTableRow(`Tisch ${label}`)).toContainText(new RegExp(`${amount}\\s€`));
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
    await expect(this.page.getByText(/an Küche & Theke gesendet/)).toBeVisible();
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
