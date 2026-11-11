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

  /**
   * Zeilenaktion: die ersten Aktionen stehen als Symbolknopf in der Zeile,
   * der Rest (und auf dem Telefon alles) im ⋯-Menü „Weitere Aktionen“.
   */
  async rowAction(eventName: string, label: string) {
    const row = this.row(eventName);
    // Erst die Zeile abwarten — sonst fiele die Prüfung unten zu früh auf
    // das Menü zurück, in dem Symbol-Aktionen auf dem Desktop fehlen.
    await expect(row).toBeVisible();
    const inline = row.getByRole('button', { name: label, exact: true });
    if (await inline.isVisible()) {
      await inline.click();
      return;
    }
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    await this.page.getByRole('menuitem', { name: label, exact: true }).click();
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

  async expectStatus(
    eventName: string,
    status: 'Aktiv' | 'Inaktiv' | 'Testmodus' | 'Geplant' | 'Beendet',
  ) {
    // Unter dem Badge steht je nach Phase ein Hinweis (Verkauf bis …).
    await expect(this.row(eventName).getByRole('cell').nth(1).locator('.badge')).toHaveText(status);
  }
}
