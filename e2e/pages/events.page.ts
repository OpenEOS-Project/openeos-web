import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Events Page
 */
export class EventsPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly eventsList: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.getByRole('button', { name: /event erstellen|veranstaltung erstellen/i });
    this.eventsList = page.locator('table tbody');
    this.emptyState = page.locator('[data-testid="empty-state"]');
  }

  async goto(locale: string = 'de') {
    await this.page.goto(`/${locale}/events`);
  }

  async createEvent(data: { name: string; description?: string; startDate: string; endDate: string }) {
    await this.createButton.click();

    // Fill form
    await this.page.getByLabel('Name').fill(data.name);
    if (data.description) {
      await this.page.getByLabel('Beschreibung').fill(data.description);
    }
    await this.page.getByLabel('Startdatum').fill(data.startDate);
    await this.page.getByLabel('Enddatum').fill(data.endDate);

    // Submit
    await this.page.getByRole('button', { name: /erstellen|speichern/i }).click();
  }

  async openEventActions(eventName: string) {
    const row = this.page.locator('tr').filter({ hasText: eventName });
    await row.getByRole('button', { name: /aktionen|mehr/i }).click();
  }

  async activateEvent(eventName: string) {
    await this.openEventActions(eventName);
    await this.page.getByRole('menuitem', { name: /aktivieren/i }).click();
  }

  async deleteEvent(eventName: string) {
    await this.openEventActions(eventName);
    await this.page.getByRole('menuitem', { name: /löschen/i }).click();
    await this.page.getByRole('button', { name: /löschen|bestätigen/i }).click();
  }

  async expectEventInList(eventName: string) {
    await expect(this.page.getByText(eventName)).toBeVisible();
  }

  async expectEventStatus(eventName: string, status: string) {
    const row = this.page.locator('tr').filter({ hasText: eventName });
    await expect(row.getByText(status)).toBeVisible();
  }

  async expectInsufficientCreditsModal() {
    await expect(this.page.getByText(/nicht genügend credits/i)).toBeVisible();
  }
}
