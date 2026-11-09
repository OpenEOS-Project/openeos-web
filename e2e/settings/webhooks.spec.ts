import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { delivery, WebhookApiMock } from '../fixtures/webhooks-mock';

/**
 * Webhooks in den Einstellungen (Reiter „Webhooks“ und die Seite mit den
 * Zustellungen).
 *
 * Die Endpunkte der Webhooks werden im Browser vorgetäuscht
 * (fixtures/webhooks-mock.ts). Geprüft wird die Oberfläche — Zustellung,
 * Signatur und Prüfung der Adressen testet die API selbst. Anmeldung und
 * Organisation kommen wie überall von der echten API.
 */

async function openWebhooks(page: Page) {
  await page.goto('/settings?tab=org-webhooks');
  await expect(page.getByRole('tab', { name: 'Webhooks' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Webhooks', level: 2 })).toBeVisible();
}

/** Nichts darf seitlich über den Bildschirm hinausragen. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Webhooks settings', () => {
  test('create → secret once → edit → test → deliveries → redeliver → rotate → delete', async ({ adminPage: page }) => {
    const api = new WebhookApiMock();
    await api.install(page);
    await openWebhooks(page);

    await expect(page.getByText('0 von 10 Webhooks')).toBeVisible();
    await expect(page.getByText('Noch kein Webhook angelegt.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Anleitung: Webhooks' })).toHaveAttribute(
      'href',
      'https://docs.openeos.de/integrationen/webhooks',
    );

    // Anlegen: Prüfung der Adresse im Browser, dann die Antwort der API.
    await page.getByRole('button', { name: 'Webhook anlegen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Webhook anlegen' });
    const url = dialog.getByRole('textbox', { name: /Adresse \(URL\)/ });
    await url.fill('http://hooks.example.org/openeos');
    await dialog.getByRole('button', { name: 'Webhook anlegen' }).click();
    await expect(dialog.getByText('Die Adresse muss mit https:// beginnen.')).toBeVisible();
    await expect(dialog.getByText('Wähle mindestens ein Ereignis.')).toBeVisible();

    await url.fill('https://hooks.example.org/openeos');
    await dialog.getByRole('textbox', { name: /Beschreibung/ }).fill('Buchhaltung');
    await dialog.getByRole('button', { name: 'Alle in „Bestellungen“ auswählen' }).click();
    await expect(dialog.getByText('4 gewählt')).toBeVisible();
    await expect(dialog.getByText(/In der Betriebsart „Nur Bons“/)).toBeVisible();
    await expect(dialog.getByRole('switch', { name: 'Aktiv' })).toBeChecked();
    await expect(dialog.getByRole('switch', { name: 'Gästedaten mitsenden' })).not.toBeChecked();
    await expect(dialog.getByRole('switch', { name: 'Testbestellungen mitsenden' })).not.toBeChecked();
    await expect(dialog.getByText(/Du bist dafür verantwortlich/)).toBeVisible();

    api.rejectNextCreate = { reason: 'private_address' };
    await dialog.getByRole('button', { name: 'Webhook anlegen' }).click();
    await expect(dialog.getByText('Die Adresse zeigt in ein privates Netz – das ist nicht erlaubt.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Webhook anlegen' }).click();
    const secretDialog = page.getByRole('dialog', { name: 'Webhook angelegt' });
    await expect(secretDialog.getByText('Jetzt kopieren – das Secret wird nur einmal angezeigt')).toBeVisible();
    await expect(secretDialog.getByTestId('webhook-secret')).toHaveText(/^whsec_e2eSecret1_/);
    // Escape schließt die Anzeige nicht — nur „Fertig“.
    await page.keyboard.press('Escape');
    await expect(secretDialog).toBeVisible();

    const created = api.requests.filter((r) => r.method === 'POST' && /\/webhooks$/.test(r.path)).at(-1);
    expect(created?.body).toEqual({
      url: 'https://hooks.example.org/openeos',
      description: 'Buchhaltung',
      eventTypes: ['order.created', 'order.paid', 'order.completed', 'order.cancelled'],
      active: true,
      includeGuestData: false,
      includeTestOrders: false,
    });

    await secretDialog.getByRole('button', { name: 'Fertig' }).click();
    await expect(secretDialog).toBeHidden();
    await expect(page.getByText(/whsec_e2eSecret1_/)).toHaveCount(0);

    // Liste
    const row = page.locator('tr', { hasText: 'https://hooks.example.org/openeos' });
    await expect(row).toBeVisible();
    await expect(row.getByText('Buchhaltung')).toBeVisible();
    await expect(row.getByText('4 Ereignisse')).toBeVisible();
    await expect(row.getByText('Aktiv', { exact: true })).toBeVisible();
    await expect(row.getByText('noch keine')).toBeVisible();
    await expect(page.getByText('1 von 10 Webhooks')).toBeVisible();

    // Bearbeiten: nur Geändertes geht zur API.
    await row.getByRole('button', { name: /^Bearbeiten:/ }).click();
    const edit = page.getByRole('dialog', { name: 'Webhook bearbeiten' });
    await expect(edit.getByRole('textbox', { name: /Adresse \(URL\)/ })).toHaveValue('https://hooks.example.org/openeos');
    await edit.getByRole('textbox', { name: /Beschreibung/ }).fill('Buchhaltung (Lexware)');
    await edit.getByText('Aktiv', { exact: true }).click();
    await edit.getByRole('button', { name: 'Speichern' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText('Webhook gespeichert.')).toBeVisible();
    const patch = api.requests.filter((r) => r.method === 'PATCH').at(-1);
    expect(patch?.body).toEqual({ description: 'Buchhaltung (Lexware)', active: false });
    await expect(row.getByText('Pausiert')).toBeVisible();
    await expect(row.getByText('Buchhaltung (Lexware)')).toBeVisible();

    // Test senden — geht auch bei pausiertem Webhook.
    await row.getByRole('button', { name: /^Test senden:/ }).click();
    await expect(page.getByText('Test verschickt – das Ergebnis steht gleich in den Zustellungen.')).toBeVisible();
    await expect(row.getByText('zugestellt')).toBeVisible();

    // Eine fehlgeschlagene Zustellung kommt dazu (wie vom Zusteller).
    const webhookId = api.endpoints[0].id as string;
    api.deliveries.push(
      delivery(webhookId, 'order.paid', {
        status: 'failed',
        attempts: 8,
        responseStatus: null,
        durationMs: 10000,
        error: 'TIMEOUT',
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
      }),
    );

    // Zustellungen
    await row.getByRole('link', { name: /^Zustellungen ansehen:/ }).click();
    await expect(page).toHaveURL(new RegExp(`/settings/webhooks/${webhookId}$`));
    await expect(page.getByRole('heading', { name: 'Buchhaltung (Lexware)', level: 1 })).toBeVisible();
    await expect(page.getByText('whsec_e2eA…')).toBeVisible();
    const table = page.locator('table');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.getByText('ping')).toBeVisible();
    await expect(table.getByText('Zugestellt')).toBeVisible();
    await expect(page.getByText('2 Zustellungen')).toBeVisible();

    await page.getByLabel('Status').selectOption({ label: 'Fehlgeschlagen' });
    await expect(table.locator('tbody tr')).toHaveCount(1);
    const failedRow = table.locator('tbody tr').first();
    await expect(failedRow.getByText('order.paid')).toBeVisible();
    await expect(failedRow.getByText('Zeitüberschreitung (10 s)')).toBeVisible();
    await expect(failedRow.getByText('8/8')).toBeVisible();
    expect(api.requests.some((r) => r.method === 'GET' && r.path.includes('status=failed'))).toBe(true);

    // Detail und erneut senden
    await failedRow.getByRole('button', { name: /^Details zur Zustellung order\.paid/ }).click();
    const detail = page.getByRole('dialog', { name: /Zustellung/ });
    await expect(detail.getByText('Zeitüberschreitung (10 s)').first()).toBeVisible();
    await expect(detail.getByTestId('webhook-payload')).toContainText('"type": "order.paid"');
    await expect(detail.getByText('Keine Antwort erhalten.')).toBeVisible();
    await detail.getByRole('button', { name: 'Erneut senden' }).click();
    await expect(page.getByText('Zustellung neu in die Warteschlange gestellt.')).toBeVisible();
    await expect(detail).toBeHidden();
    expect(api.requests.some((r) => r.method === 'POST' && r.path.endsWith('/redeliver'))).toBe(true);

    await page.getByLabel('Status').selectOption({ label: 'Alle Status' });
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.getByText('Ausstehend')).toBeVisible();

    // Secret erneuern: Rückfrage mit 24 h, dann einmalige Anzeige.
    await page.getByRole('button', { name: 'Secret erneuern' }).click();
    const rotate = page.getByRole('dialog', { name: 'Secret erneuern?' });
    await expect(rotate.getByText(/Das alte bleibt noch 24 Stunden gültig/)).toBeVisible();
    await rotate.getByRole('button', { name: 'Secret erneuern' }).click();
    const rotated = page.getByRole('dialog', { name: 'Neues Secret' });
    await expect(rotated.getByTestId('webhook-secret')).toHaveText(/^whsec_e2eSecret2_/);
    await expect(rotated.getByText(/Das alte Secret gilt noch bis/)).toBeVisible();
    await rotated.getByRole('button', { name: 'Fertig' }).click();
    await expect(rotated).toBeHidden();

    // Löschen führt zurück zur Liste.
    await page.getByRole('button', { name: 'Löschen' }).click();
    const del = page.getByRole('dialog', { name: 'Webhook löschen?' });
    await expect(del.getByText(/https:\/\/hooks\.example\.org\/openeos/)).toBeVisible();
    await del.getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByText('Webhook gelöscht.')).toBeVisible();
    await expect(page).toHaveURL(/\/settings\?tab=org-webhooks$/);
    await expect(page.getByText('Noch kein Webhook angelegt.')).toBeVisible();
    expect(api.requests.some((r) => r.method === 'DELETE')).toBe(true);
  });

  test('limit reached and server switched off', async ({ adminPage: page }) => {
    const api = new WebhookApiMock();
    api.info.maxEndpoints = 2;
    api.seedEndpoint({ url: 'https://a.example.org/hook', eventTypes: ['order.paid'] });
    const failing = api.seedEndpoint({ url: 'https://b.example.org/hook', eventTypes: ['order.paid', 'refund.created'] });
    Object.assign(failing, { consecutiveFailures: 3, failingSince: '2026-11-09T10:00:00.000Z' });
    await api.install(page);
    await openWebhooks(page);

    await expect(page.getByText('2 von 2 Webhooks')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Webhook anlegen' })).toBeDisabled();
    await expect(page.getByText('Höchstzahl erreicht')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'b.example.org' }).getByText(/^Fehler seit 09\.11\.2026/)).toBeVisible();

    api.info.enabled = false;
    await page.reload();
    await expect(page.getByText('Webhooks sind auf diesem Server ausgeschaltet')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Test senden:/ }).first()).toBeDisabled();
  });

  test('access tab links to webhooks', async ({ adminPage: page }) => {
    const api = new WebhookApiMock();
    await api.install(page);
    await page.goto('/settings?tab=org-access');
    await page.getByRole('button', { name: 'Webhooks', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Webhooks' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Webhooks', level: 2 })).toBeVisible();
  });

  test('/settings/webhooks opens the webhooks tab', async ({ adminPage: page }) => {
    const api = new WebhookApiMock();
    await api.install(page);
    await page.goto('/settings/webhooks');
    await expect(page).toHaveURL(/\/settings\?tab=org-webhooks$/);
    await expect(page.getByRole('tab', { name: 'Webhooks' })).toHaveAttribute('aria-selected', 'true');
  });

  test('members see the hint instead of the list', async ({ memberPage: page }) => {
    const api = new WebhookApiMock();
    await api.install(page);
    await openWebhooks(page);
    await expect(page.getByText('Webhooks kann nur ein Admin der Organisation sehen und anlegen.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Webhook anlegen' })).toHaveCount(0);
    expect(api.requests).toHaveLength(0);
  });

  test('mobile: list, deliveries and detail without horizontal scrolling', async ({ adminPage: page }) => {
    const api = new WebhookApiMock();
    const endpoint = api.seedEndpoint({
      url: 'https://very-long-subdomain.hooks.example.org/openeos/webhooks/receiver/with/a/long/path?token=abcdef',
      description: 'Warenwirtschaft',
      eventTypes: ['order.paid', 'refund.created', 'product.updated'],
    });
    api.deliveries.push(
      delivery(endpoint.id as string, 'order.paid'),
      delivery(endpoint.id as string, 'refund.created', {
        status: 'failed',
        error: 'BLOCKED_ADDRESS',
        responseStatus: null,
        attempts: 3,
        nextAttemptAt: new Date(Date.now() + 1800_000).toISOString(),
      }),
    );
    await api.install(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openWebhooks(page);
    await expect(page.getByText('Warenwirtschaft', { exact: true })).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.getByRole('link', { name: /^Zustellungen ansehen:/ }).click();
    await expect(page.getByRole('heading', { name: 'Warenwirtschaft', level: 1 })).toBeVisible();
    await expect(page.getByText('Ziel-Adresse nicht erlaubt (privates Netz)')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: /^Details zur Zustellung refund\.created/ }).click();
    const detail = page.getByRole('dialog', { name: /Zustellung/ });
    await expect(detail.getByTestId('webhook-payload')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
