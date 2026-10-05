import { test, expect } from '../fixtures/auth.fixture';
import { EventsPage } from '../pages/events.page';

/** Eindeutig je Lauf: lokal laeuft die Suite wiederholt gegen dieselbe Datenbank. */
const unique = (prefix: string) => `${prefix} ${Date.now()}`;

test.describe('Events', () => {
  test.describe('Event List', () => {
    test('shows events page with create button', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();
      await expect(eventsPage.createButton).toBeVisible();
    });
  });

  test.describe('Event Creation', () => {
    test('can create a new event', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Sommerfest');
      await eventsPage.createEvent({
        name: eventName,
        description: 'E2E Test Event',
        startDate: '2026-03-01',
        endDate: '2026-03-03',
      });

      const row = eventsPage.row(eventName);
      await expect(row).toContainText('E2E Test Event');
      await expect(row).toContainText('01.03.2026 – 03.03.2026');
    });

    test('new event starts inactive', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Entwurf');
      await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });

      await eventsPage.expectStatus(eventName, 'Inaktiv');
      // Eintaegig: nur ein Datum, kein Bereich.
      await expect(eventsPage.row(eventName)).toContainText('01.03.2026');
      await expect(eventsPage.row(eventName)).not.toContainText('–');
    });

    test('requires a name', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      await eventsPage.createButton.click();
      await eventsPage.modal.getByLabel('Startdatum').fill('2026-03-01');
      await eventsPage.modal.getByRole('button', { name: 'Erstellen' }).click();
      await expect(eventsPage.modal.getByText('Bitte geben Sie einen Namen ein')).toBeVisible();
    });

    // Eigenstaendig kostet eine Veranstaltung nichts; der Preis-Hinweis
    // des gehosteten Betriebs darf im Dialog nicht auftauchen.
    test('shows no price on a self-hosted install', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      await eventsPage.createButton.click();
      await eventsPage.modal.getByLabel('Startdatum').fill('2026-03-01');
      await eventsPage.modal.getByLabel('Enddatum').fill('2026-03-03');
      await expect(eventsPage.modal.getByText('3 Veranstaltungstage')).toBeVisible();
      await expect(eventsPage.modal.getByText(/Freischalten kostet/)).toHaveCount(0);
    });
  });

  test.describe('Event Activation', () => {
    // Ersetzt "shows insufficient credits modal": Guthaben gibt es nicht
    // mehr (abgerechnet wird je Veranstaltung), und eigenstaendig gar
    // nicht. Dort aktiviert der Knopf sofort, ohne Bezahldialog.
    test('activates a draft event without any payment step', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Aktivierung');
      await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });

      await eventsPage.row(eventName).getByRole('button', { name: 'Aktivieren' }).click();
      await eventsPage.expectStatus(eventName, 'Aktiv');
      await expect(eventsPage.modal).toHaveCount(0);

      // Die Seitenleiste zeigt die aktive Veranstaltung.
      await expect(adminPage.getByRole('complementary').getByRole('link', { name: new RegExp(eventName) })).toBeVisible();
    });

    test('can switch an event to test mode and deactivate it', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Testlauf');
      await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });

      await eventsPage.row(eventName).getByRole('button', { name: 'Testmodus' }).click();
      await eventsPage.expectStatus(eventName, 'Testmodus');

      await eventsPage.row(eventName).getByRole('button', { name: 'Deaktivieren' }).click();
      await eventsPage.expectStatus(eventName, 'Inaktiv');
    });

    test('only one event is active at a time', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const first = unique('Erstes');
      await eventsPage.createEvent({ name: first, startDate: '2026-03-01' });
      await eventsPage.row(first).getByRole('button', { name: 'Aktivieren' }).click();
      await eventsPage.expectStatus(first, 'Aktiv');

      const second = unique('Zweites');
      await eventsPage.createEvent({ name: second, startDate: '2026-03-02' });
      await eventsPage.row(second).getByRole('button', { name: 'Aktivieren' }).click();
      await eventsPage.expectStatus(second, 'Aktiv');
      await eventsPage.expectStatus(first, 'Inaktiv');
    });
  });

  test.describe('Event Deletion', () => {
    test('can delete an event', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Loeschen');
      await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });

      await eventsPage.row(eventName).getByRole('button', { name: 'Löschen' }).click();
      await expect(eventsPage.modal.getByRole('heading', { name: 'Veranstaltung löschen' })).toBeVisible();
      await eventsPage.modal.getByRole('button', { name: 'Löschen' }).click();

      await expect(eventsPage.modal).toHaveCount(0);
      await expect(eventsPage.row(eventName)).toHaveCount(0);

      // Auch nach dem Neuladen weg — nicht nur aus dem Cache genommen.
      await adminPage.reload();
      await expect(adminPage.getByRole('heading', { name: 'Veranstaltungen', level: 1 })).toBeVisible();
      await expect(adminPage.getByText(eventName)).toHaveCount(0);
    });

    test('cancelling the delete dialog keeps the event', async ({ adminPage }) => {
      const eventsPage = new EventsPage(adminPage);
      await eventsPage.goto();

      const eventName = unique('Behalten');
      await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });

      await eventsPage.row(eventName).getByRole('button', { name: 'Löschen' }).click();
      await eventsPage.modal.getByRole('button', { name: 'Abbrechen' }).click();
      await expect(eventsPage.modal).toHaveCount(0);
      await expect(eventsPage.row(eventName)).toBeVisible();
    });
  });
});
