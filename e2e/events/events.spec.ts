import { test, expect } from '../fixtures/auth.fixture';
import { EventsPage } from '../pages/events.page';
import { TEST_EVENT } from '../fixtures/test-data';

test.describe('Events', () => {
  test.describe('Event List', () => {
    test('shows events page', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      await expect(authenticatedPage.getByText(/veranstaltungen|events/i)).toBeVisible();
    });

    test('shows create button', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      await expect(eventsPage.createButton).toBeVisible();
    });
  });

  test.describe('Event Creation', () => {
    test('can create a new event', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      const eventName = `Test Event ${Date.now()}`;

      await eventsPage.createEvent({
        name: eventName,
        description: 'E2E Test Event',
        startDate: '2026-03-01',
        endDate: '2026-03-03',
      });

      // Wait for modal to close and list to update
      await authenticatedPage.waitForTimeout(1000);

      await eventsPage.expectEventInList(eventName);
    });

    test('new event has draft status', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      const eventName = `Draft Event ${Date.now()}`;

      await eventsPage.createEvent({
        name: eventName,
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      await authenticatedPage.waitForTimeout(1000);

      await eventsPage.expectEventStatus(eventName, 'Entwurf');
    });
  });

  test.describe('Event Activation', () => {
    test('can activate a draft event', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      // Create a new event first
      const eventName = `Activate Test ${Date.now()}`;
      await eventsPage.createEvent({
        name: eventName,
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      await authenticatedPage.waitForTimeout(1000);

      // Activate it
      await eventsPage.activateEvent(eventName);

      await authenticatedPage.waitForTimeout(1000);

      // Should now be active
      await eventsPage.expectEventStatus(eventName, 'Aktiv');
    });

    test('shows insufficient credits modal when no credits available', async ({
      authenticatedPage,
    }) => {
      // This test assumes the user has 0 credits
      // Skip if the test user has credits
      test.skip();

      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      const eventName = `No Credits Test ${Date.now()}`;
      await eventsPage.createEvent({
        name: eventName,
        startDate: '2026-03-01',
        endDate: '2026-03-10', // 10 days = 100 credits
      });

      await authenticatedPage.waitForTimeout(1000);

      await eventsPage.activateEvent(eventName);

      await eventsPage.expectInsufficientCreditsModal();
    });
  });

  test.describe('Event Deletion', () => {
    test('can delete an event', async ({ authenticatedPage }) => {
      const eventsPage = new EventsPage(authenticatedPage);
      await eventsPage.goto();

      // Create a new event first
      const eventName = `Delete Test ${Date.now()}`;
      await eventsPage.createEvent({
        name: eventName,
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      });

      await authenticatedPage.waitForTimeout(1000);

      // Delete it
      await eventsPage.deleteEvent(eventName);

      await authenticatedPage.waitForTimeout(1000);

      // Should no longer be in list
      await expect(authenticatedPage.getByText(eventName)).not.toBeVisible();
    });
  });
});
