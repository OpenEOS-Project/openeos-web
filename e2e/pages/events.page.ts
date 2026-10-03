import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Veranstaltungsliste (events/components/events-list.tsx).
 */
export class EventsPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly modal: Locator;

  constructor(page: Page) {
    this.page = page;
    // In der leeren Liste und im Kopf der Tabelle steht derselbe Knopf;
    // es ist immer genau einer sichtbar.
    this.createButton = page.getByRole('main').getByRole('button', { name: 'Veranstaltung erstellen' });
    this.modal = page.getByRole('dialog');
  }

  async goto() {
    await this.page.goto('/events');
    await expect(this.page.getByRole('heading', { name: 'Veranstaltungen', level: 1 })).toBeVisible();
  }

  row(eventName: string): Locator {
    return this.page.getByRole('row').filter({ hasText: eventName });
  }

  async createEvent(data: { name: string; description?: string; startDate: string; endDate?: string }) {
    await this.createButton.click();
    await this.modal.getByRole('textbox', { name: 'Name' }).fill(data.name);
    if (data.description) {
      await this.modal.getByRole('textbox', { name: 'Beschreibung' }).fill(data.description);
    }
    await this.modal.getByLabel('Startdatum').fill(data.startDate);
    if (data.endDate) {
      await this.modal.getByLabel('Enddatum').fill(data.endDate);
    }
    await this.modal.getByRole('button', { name: 'Erstellen' }).click();
    // Der Dialog schliesst erst, wenn die API das Anlegen bestaetigt hat.
    await expect(this.modal).toHaveCount(0);
    await expect(this.row(data.name)).toBeVisible();
  }

  async expectStatus(eventName: string, status: 'Aktiv' | 'Inaktiv' | 'Testmodus') {
    await expect(this.row(eventName).getByRole('cell').nth(1)).toHaveText(status);
  }
}
