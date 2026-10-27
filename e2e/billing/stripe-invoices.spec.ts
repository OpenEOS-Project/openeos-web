import type { Page, Route } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { EventsPage } from '../pages/events.page';

/**
 * Auf Rechnung über Stripe — Rechnungsliste und Freischaltungs-Dialog.
 *
 * Wie beim Storno-Test laeuft die Suite gegen eine eigenstaendige
 * Installation ohne Abrechnung; Betriebsart, Rechnungen und
 * Abrechnungsstand werden vorgetaeuscht. Geprueft wird die Oberflaeche,
 * nicht Stripe — das decken die Tests der API ab.
 */

const unique = (prefix: string) => `${prefix} ${Date.now()}`;

const PAST = '2020-01-15T10:00:00.000Z';
const FUTURE = '2099-01-15T10:00:00.000Z';
const HOSTED = 'https://invoice.stripe.com/i/acct_test/test_open';

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

function invoiceRow(overrides: Record<string, unknown>) {
  return {
    id: 'in_x',
    kind: 'invoice',
    relatedInvoiceNumber: null,
    number: 'OE-0001',
    issuedAt: '2026-10-01T10:00:00.000Z',
    total: 40,
    currency: 'EUR',
    status: 'open',
    paid: false,
    dueAt: null,
    description: '2 Veranstaltungstage (6 bis 6 Uhr) – Sommerfest, 11.09.2026',
    hostedUrl: HOSTED,
    hasPdf: true,
    ...overrides,
  };
}

function billingBody(overrides: Record<string, unknown> = {}) {
  return {
    pricePerDay: 25,
    days: 2,
    price: 50,
    discountPercent: 20,
    discountReason: 'first-event',
    finalPrice: 40,
    onlinePaymentAvailable: true,
    billingMode: 'invoice',
    billingStatus: 'invoice',
    organizationName: 'E2E Verein',
    billingEmail: 'kasse@example.org',
    billingAddress: null,
    paidAt: '2026-08-01T10:00:00.000Z',
    priceCharged: 40,
    cancellation: { allowed: true, deadline: '2099-01-01T15:00:00.000Z', timezone: 'Europe/Berlin', blockedReason: null },
    lastCancellation: null,
    invoiceViaStripe: true,
    invoiceDaysUntilDue: 14,
    invoice: {
      id: 'in_open',
      number: 'OE-0002',
      status: 'open',
      dueAt: FUTURE,
      paidAt: null,
      hostedUrl: HOSTED,
    },
    ...overrides,
  };
}

test.describe('Stripe invoices', () => {
  test('lists invoices with due date, overdue status and a pay link', async ({ adminPage }) => {
    await pretendHosted(adminPage);
    await adminPage.route(/\/billing\/invoices$/, (route: Route) =>
      route.fulfill({
        json: {
          data: [
            invoiceRow({ id: 'in_open', number: 'OE-0003', status: 'open', dueAt: FUTURE }),
            // Die API meldet noch "open", das Datum ist aber schon vorbei.
            invoiceRow({ id: 'in_late', number: 'OE-0002', status: 'open', dueAt: PAST }),
            invoiceRow({ id: 'in_paid', number: 'OE-0001', status: 'paid', paid: true, dueAt: PAST }),
            invoiceRow({ id: 'in_void', number: 'OE-0000', status: 'void', dueAt: FUTURE }),
          ],
        },
      }),
    );

    await adminPage.goto('/invoices');
    const rows = adminPage.getByTestId('invoice-row');
    await expect(rows).toHaveCount(4);

    const open = rows.filter({ hasText: 'OE-0003' });
    await expect(open.getByTestId('invoice-status')).toHaveText('Offen');
    await expect(open.getByText('15.01.2099')).toBeVisible();
    await expect(open.getByRole('link', { name: 'Bezahlen' })).toHaveAttribute('href', HOSTED);

    const late = rows.filter({ hasText: 'OE-0002' });
    await expect(late.getByTestId('invoice-status')).toHaveText('Überfällig');
    await expect(late.getByRole('link', { name: 'Bezahlen' })).toBeVisible();

    const paid = rows.filter({ hasText: 'OE-0001' });
    await expect(paid.getByTestId('invoice-status')).toHaveText('Bezahlt');
    await expect(paid.getByRole('link', { name: 'Bezahlen' })).toHaveCount(0);

    const voided = rows.filter({ hasText: 'OE-0000' });
    await expect(voided.getByTestId('invoice-status')).toHaveText('Storniert');
    await expect(voided.getByRole('link', { name: 'Bezahlen' })).toHaveCount(0);
  });

  test('activation dialog shows the open invoice and what cancelling does', async ({ adminPage }) => {
    const eventsPage = new EventsPage(adminPage);
    await eventsPage.goto();
    const eventName = unique('Rechnung');
    await eventsPage.createEvent({ name: eventName, startDate: '2026-09-11' });

    await pretendHosted(adminPage);
    await adminPage.route(/\/organizations\/[^/]+\/events(\?.*)?$/, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const json = await response.json();
      for (const event of json.data ?? []) {
        if (event.name === eventName) event.billingStatus = 'invoice';
      }
      await route.fulfill({ response, json });
    });
    await adminPage.route(/\/events\/[^/]+\/billing$/, (route) => route.fulfill({ json: { data: billingBody() } }));

    await adminPage.reload();
    await eventsPage.row(eventName).getByRole('button', { name: 'Freischaltung' }).click();
    const dialog = adminPage.getByRole('dialog');
    await expect(dialog.getByTestId('unlock-status')).toHaveText('Freigeschaltet – auf Rechnung bestellt');
    await expect(dialog.getByTestId('unlock-invoice')).toContainText('Rechnung OE-0002 · offen · fällig am 15.01.2099');
    await expect(dialog.getByRole('link', { name: 'Rechnung bezahlen' })).toHaveAttribute('href', HOSTED);

    await dialog.getByRole('button', { name: 'Freischaltung stornieren' }).click();
    await expect(dialog.getByText('Rechnungsbetrag, der entfällt')).toBeVisible();
    await expect(dialog.getByText(/Sie wird storniert, du musst nichts mehr zahlen/)).toBeVisible();
  });
});
