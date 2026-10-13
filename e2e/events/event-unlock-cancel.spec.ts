import type { Page, Route } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { EventsPage } from '../pages/events.page';

/**
 * Freischaltung stornieren — der Dialog.
 *
 * Die E2E-Suite laeuft gegen eine eigenstaendige Installation, in der es
 * keine Abrechnung gibt. Deshalb werden die Antworten fuer den gehosteten
 * Betrieb hier vorgetaeuscht: Betriebsart, Abrechnungsstand der einen
 * Veranstaltung und die Antwort auf das Stornieren. Geprueft wird die
 * Oberflaeche, nicht Stripe — das decken die Tests der API ab.
 */

const unique = (prefix: string) => `${prefix} ${Date.now()}`;

const DEADLINE = '2026-09-04T15:00:00.000Z';

function billingBody(overrides: Record<string, unknown> = {}) {
  return {
    pricePerDay: 25,
    days: 2,
    price: 50,
    discountPercent: 20,
    discountReason: 'first-event',
    finalPrice: 40,
    onlinePaymentAvailable: true,
    billingMode: 'prepaid',
    billingStatus: 'paid',
    organizationName: 'E2E Verein',
    billingEmail: 'kasse@example.org',
    billingAddress: null,
    paidAt: '2026-08-01T10:00:00.000Z',
    priceCharged: 40,
    cancellation: { allowed: true, deadline: DEADLINE, timezone: 'Europe/Berlin', blockedReason: null },
    lastCancellation: null,
    ...overrides,
  };
}

/** Tut so, als liefe die Installation gehostet mit Abrechnung. */
async function pretendHosted(page: Page) {
  await page.route(/\/setup\/status$/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.data = {
      ...json.data,
      deployment: { mode: 'saas', billingEnabled: true, multiTenant: true },
    };
    await route.fulfill({ response, json });
  });
}

/** Markiert die Veranstaltung in der Liste als bezahlt. */
async function markPaidInList(page: Page, eventName: string) {
  await page.route(/\/organizations\/[^/]+\/events(\?.*)?$/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const json = await response.json();
    for (const event of json.data ?? []) {
      if (event.name === eventName) event.billingStatus = 'paid';
    }
    await route.fulfill({ response, json });
  });
}

test.describe('Event activation cancellation', () => {
  test('shows the deadline and cancels after confirmation', async ({ adminPage }) => {
    const eventsPage = new EventsPage(adminPage);
    await eventsPage.goto();
    const eventName = unique('Storno');
    await eventsPage.createEvent({ name: eventName, startDate: '2026-09-11' });

    await pretendHosted(adminPage);
    await markPaidInList(adminPage, eventName);

    let cancelled = false;
    await adminPage.route(/\/events\/[^/]+\/billing$/, (route) =>
      route.fulfill({
        json: {
          data: cancelled
            ? billingBody({
                billingStatus: 'none',
                paidAt: null,
                priceCharged: null,
                cancellation: { allowed: false, deadline: DEADLINE, timezone: 'Europe/Berlin', blockedReason: 'not_paid' },
                lastCancellation: {
                  id: 'c1',
                  cancelledAt: '2026-08-20T10:00:00.000Z',
                  amount: 40,
                  currency: 'EUR',
                  previousBillingStatus: 'paid',
                  refundStatus: 'pending',
                  creditNoteNumber: 'ABC-0001-CN-01',
                },
              })
            : billingBody(),
        },
      }),
    );
    let cancelCalls = 0;
    await adminPage.route(/\/events\/[^/]+\/billing\/cancel$/, (route) => {
      cancelCalls += 1;
      cancelled = true;
      return route.fulfill({
        json: {
          data: {
            cancellation: {
              id: 'c1',
              cancelledAt: '2026-08-20T10:00:00.000Z',
              amount: 40,
              currency: 'EUR',
              previousBillingStatus: 'paid',
              refundStatus: 'pending',
              creditNoteNumber: 'ABC-0001-CN-01',
            },
            billing: billingBody({ billingStatus: 'none' }),
          },
        },
      });
    });

    await adminPage.reload();
    await expect(adminPage.getByRole('heading', { name: 'Veranstaltungen', level: 1 })).toBeVisible();

    await eventsPage.row(eventName).getByRole('button', { name: 'Freischaltung' }).click();
    const dialog = adminPage.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Freischaltung' })).toBeVisible();
    await expect(dialog.getByTestId('unlock-status')).toHaveText('Freigeschaltet – bezahlt per Karte oder Lastschrift');
    await expect(dialog.getByText('40,00 € bezahlt am 01.08.2026')).toBeVisible();
    await expect(dialog.getByTestId('unlock-deadline')).toHaveText(
      'Kostenlos stornierbar bis Fr., 04.09.2026, 17:00.',
    );

    // Erste Stufe bewegt noch kein Geld.
    await dialog.getByRole('button', { name: 'Freischaltung stornieren' }).click();
    await expect(dialog.getByRole('heading', { name: 'Freischaltung stornieren?' })).toBeVisible();
    await expect(dialog.getByText('Du bekommst zurück')).toBeVisible();
    await expect(dialog.getByText(/Karte bzw\. das Konto zurück/)).toBeVisible();
    await expect(dialog.getByText('Eine Bestätigung geht an kasse@example.org.')).toBeVisible();
    expect(cancelCalls).toBe(0);

    // Zurück führt zur Übersicht, ohne zu stornieren.
    await dialog.getByRole('button', { name: 'Zurück' }).click();
    await expect(dialog.getByRole('heading', { name: 'Freischaltung', exact: true })).toBeVisible();
    expect(cancelCalls).toBe(0);

    await dialog.getByRole('button', { name: 'Freischaltung stornieren' }).click();
    await dialog.getByRole('button', { name: 'Jetzt stornieren' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(adminPage.getByText('Freischaltung storniert – 40,00 € werden erstattet.')).toBeVisible();
    expect(cancelCalls).toBe(1);
  });

  test('after the deadline it points to support instead of offering a button', async ({ adminPage }) => {
    const eventsPage = new EventsPage(adminPage);
    await eventsPage.goto();
    const eventName = unique('Fristende');
    await eventsPage.createEvent({ name: eventName, startDate: '2026-09-11' });

    await pretendHosted(adminPage);
    await markPaidInList(adminPage, eventName);
    await adminPage.route(/\/events\/[^/]+\/billing$/, (route) =>
      route.fulfill({
        json: {
          data: billingBody({
            cancellation: {
              allowed: false,
              deadline: DEADLINE,
              timezone: 'Europe/Berlin',
              blockedReason: 'deadline_passed',
            },
          }),
        },
      }),
    );

    await adminPage.reload();
    await eventsPage.row(eventName).getByRole('button', { name: 'Freischaltung' }).click();
    const dialog = adminPage.getByRole('dialog');
    await expect(
      dialog.getByText(
        'Die Frist für eine kostenlose Stornierung ist am Fr., 04.09.2026, 17:00 abgelaufen. Bitte wende dich an den Support.',
      ),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Freischaltung stornieren' })).toHaveCount(0);
  });

  test('shows the API refusal when orders appeared in the meantime', async ({ adminPage }) => {
    const eventsPage = new EventsPage(adminPage);
    await eventsPage.goto();
    const eventName = unique('Bestellt');
    await eventsPage.createEvent({ name: eventName, startDate: '2026-09-11' });

    await pretendHosted(adminPage);
    await markPaidInList(adminPage, eventName);
    await adminPage.route(/\/events\/[^/]+\/billing$/, (route) => route.fulfill({ json: { data: billingBody() } }));
    await adminPage.route(/\/events\/[^/]+\/billing\/cancel$/, (route) =>
      route.fulfill({
        status: 400,
        json: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            reason: 'EVENT_HAS_ORDERS',
            message: 'In der Veranstaltung gibt es schon Bestellungen',
          },
        },
      }),
    );

    await adminPage.reload();
    await eventsPage.row(eventName).getByRole('button', { name: 'Freischaltung' }).click();
    const dialog = adminPage.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Freischaltung stornieren' }).click();
    await dialog.getByRole('button', { name: 'Jetzt stornieren' }).click();
    await expect(dialog.getByRole('alert')).toContainText('In der Veranstaltung gibt es schon Bestellungen');
  });
});
