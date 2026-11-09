import type { Page, Route } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { todayKey } from '../fixtures/test-data';
import { EventsPage } from '../pages/events.page';

/**
 * Cloud-TSE „Bald verfügbar“: Die gehostete Installation läuft ohne
 * Swissbit-Vertrag (`TSE_PROVIDER=none`, `TSE_COMING_SOON=true`) und meldet
 * `availability: 'coming_soon'`. Eine eigene Installation ohne Provider
 * meldet `not_configured` und behält „Nicht verfügbar“.
 *
 * Die E2E-Suite läuft gegen eine eigene Installation; Betrieb, Land und
 * TSE-Stand werden deshalb in den Antworten vorgetäuscht. Geprüft wird die
 * Oberfläche — die Regel selbst testet die API (tse-availability.spec.ts).
 */

type Availability = 'coming_soon' | 'not_configured';

const ORG_DETAIL = /\/organizations\/[0-9a-f-]{36}$/;
const ORG_TSE = /\/organizations\/[0-9a-f-]{36}\/tse$/;
const ORG_MODE = /\/organizations\/[0-9a-f-]{36}\/operating-mode$/;

async function patchJson(route: Route, patch: (data: Record<string, unknown>) => Record<string, unknown>) {
  if (route.request().method() !== 'GET') return route.fallback();
  const response = await route.fetch();
  const json = await response.json();
  json.data = patch(json.data ?? {});
  await route.fulfill({ response, json });
}

function tseSummary(availability: Availability) {
  return {
    available: false,
    availability,
    integrationEnabled: false,
    active: false,
    state: null,
    serialNumber: null,
    clientId: null,
  };
}

/** Deutschland, „Bargeldlos“, ohne TSE — wie eine neue Organisation. */
async function pretend(page: Page, availability: Availability, { hosted }: { hosted: boolean }) {
  if (hosted) {
    await page.route(/\/setup\/status$/, (route) =>
      patchJson(route, (data) => ({
        ...data,
        deployment: { mode: 'saas', billingEnabled: true, multiTenant: true },
      })),
    );
  }
  await page.route(ORG_DETAIL, (route) =>
    patchJson(route, (data) => ({
      ...data,
      country: 'DE',
      operatingMode: 'cashless',
      operatingModeLegacy: false,
      tseActive: false,
      cashAllowed: false,
      tse: tseSummary(availability),
    })),
  );
  await page.route(ORG_MODE, (route) =>
    patchJson(route, (data) => ({
      ...data,
      country: 'DE',
      operatingMode: 'cashless',
      operatingModeLegacy: false,
      tseActive: false,
      cashAllowed: false,
      options: [
        { mode: 'orders_only', available: true, unavailableReason: null },
        { mode: 'cashless', available: true, unavailableReason: null },
        {
          mode: 'full',
          available: false,
          unavailableReason: availability === 'coming_soon' ? 'tse_coming_soon' : 'tse_required',
        },
      ],
      tseSetup: null,
    })),
  );
  await page.route(ORG_TSE, (route) =>
    patchJson(route, (data) => ({
      ...data,
      available: false,
      availability,
      integrationEnabled: false,
      country: 'DE',
      eligibility: { ok: false, reason: 'TSE_NOT_AVAILABLE', availableFrom: null, event: null },
      unit: null,
    })),
  );
}

const SOON_TEXT =
  'Die Cloud-TSE für Barzahlungen in Deutschland kommt in Kürze. Bis dahin kannst du „Nur Bons“ oder „Bargeldlos“ nutzen.';

test.describe('Cloud-TSE coming soon', () => {
  test('hosted without provider: catalog, info dialog, TSE page and operating modes say „Bald verfügbar“', async ({
    adminPage,
  }) => {
    await pretend(adminPage, 'coming_soon', { hosted: true });

    await adminPage.goto('/integrations');
    const card = adminPage.getByRole('button', { name: /^Cloud-TSE/ });
    await expect(card).toBeVisible();
    await expect(card.getByText('Bald verfügbar', { exact: true })).toBeVisible();
    await expect(card.getByText('Nicht verfügbar')).toHaveCount(0);
    const hint = adminPage.getByTestId('tse-hint');
    await expect(hint).toHaveAttribute('data-step', 'coming_soon');
    await expect(hint).toContainText(SOON_TEXT);

    await card.click();
    const dialog = adminPage.getByRole('dialog', { name: 'Cloud-TSE' });
    await expect(dialog.getByTestId('integration-coming-soon-hint')).toHaveText(SOON_TEXT);
    await expect(dialog.getByRole('button', { name: 'Aktivieren', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Schließen' }).last().click();

    await adminPage.goto('/integrations/tse');
    const page = adminPage.getByTestId('tse-integration');
    await expect(page).toHaveAttribute('data-step', 'coming_soon');
    await expect(page.getByText('Bald verfügbar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Auf diesem Server nicht eingerichtet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Jetzt einrichten' })).toHaveCount(0);

    await adminPage.goto('/settings?tab=org-mode');
    const full = adminPage.getByTestId('operating-mode-option-full');
    await expect(full).toContainText('Bald verfügbar – mit Cloud-TSE');
    await expect(full.getByRole('radio')).toBeDisabled();
    await expect(full.getByTestId('operating-mode-tse')).toContainText('Cloud-TSE bald verfügbar');
    await expect(adminPage.getByTestId('country-notice-de')).toContainText('die kommt in Kürze');
  });

  test('checkout: no Cloud-TSE question, only the „Bald verfügbar“ note', async ({ adminPage }) => {
    const events = new EventsPage(adminPage);
    await events.goto();
    const eventName = `TSE bald ${Date.now()}`;
    await events.createEvent({ name: eventName, startDate: todayKey() });

    await pretend(adminPage, 'coming_soon', { hosted: true });
    // Bestand in Deutschland: mit verfügbarer TSE käme hier die Frage.
    await adminPage.route(/\/events\/[^/]+\/billing$/, (route) =>
      route.fulfill({
        json: {
          data: {
            pricePerDay: 25,
            days: 1,
            price: 25,
            discountPercent: 0,
            discountReason: null,
            finalPrice: 25,
            onlinePaymentAvailable: true,
            billingMode: 'prepaid',
            billingStatus: 'none',
            organizationName: 'E2E Verein',
            billingEmail: 'kasse@example.org',
            billingAddress: { street: 'Hauptstr. 1', zip: '12345', city: 'Musterstadt' },
            paidAt: null,
            priceCharged: null,
            cancellation: { allowed: false, deadline: null, timezone: 'Europe/Berlin', blockedReason: 'not_paid' },
            lastCancellation: null,
            tse: { offer: null, surcharge: 0, missing: [], comingSoon: true, included: null, surchargeCharged: null },
          },
        },
      }),
    );
    await events.goto();
    await events.row(eventName).getByRole('button', { name: 'Aktivieren' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Veranstaltung aktivieren' })).toBeVisible();
    const note = adminPage.getByTestId('checkout-tse-coming-soon');
    await expect(note).toContainText('Bald verfügbar');
    await expect(note).toContainText('Die Cloud-TSE für Barzahlungen in Deutschland kommt in Kürze.');
    await expect(adminPage.getByTestId('checkout-tse')).toHaveCount(0);
    await expect(adminPage.getByTestId('checkout-tse-yes')).toHaveCount(0);
  });

  test('self-hosted without provider keeps „Nicht verfügbar“', async ({ adminPage }) => {
    await pretend(adminPage, 'not_configured', { hosted: false });

    await adminPage.goto('/integrations');
    const card = adminPage.getByRole('button', { name: /^Cloud-TSE/ });
    await expect(card.getByText('Nicht verfügbar', { exact: true })).toBeVisible();
    await expect(card.getByText('Bald verfügbar')).toHaveCount(0);

    await card.click();
    const dialog = adminPage.getByRole('dialog', { name: 'Cloud-TSE' });
    await expect(dialog.getByTestId('integration-unavailable-hint')).toContainText(
      'Auf diesem Server ist keine Cloud-TSE eingerichtet',
    );
    await dialog.getByRole('button', { name: 'Schließen' }).last().click();

    await adminPage.goto('/settings?tab=org-mode');
    const full = adminPage.getByTestId('operating-mode-option-full');
    await expect(full).toContainText('benötigt eine aktive Cloud-TSE');
    await expect(full).not.toContainText('Bald verfügbar');
    await expect(adminPage.getByTestId('country-notice-de')).not.toContainText('die kommt in Kürze');
  });
});
