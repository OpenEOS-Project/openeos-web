import type { Route } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { EventsPage } from '../pages/events.page';

/**
 * Das ⋯-Menü einer Zeile in einer Liste mit nur einer Zeile.
 *
 * Die Karte um die Tabelle schneidet ab (overflow: hidden). Das Menü der
 * letzten Zeile öffnete nach unten und war dann zum grossen Teil
 * abgeschnitten — die Punkte liessen sich nicht anklicken. Seit
 * @openeos/ui 0.7.1 beachtet das Dropdown auch den senkrechten Rand
 * abschneidender Vorfahren und öffnet nach oben.
 * Gemeldet in OpenEOS-Project/openeos-web#185.
 */

const unique = (prefix: string) => `${prefix} ${Date.now()}`;

test.describe('Row actions menu', () => {
  test('opens fully visible in a list with a single row', async ({ adminPage }) => {
    const eventName = unique('Einzeiler');
    // Die Organisation der Suite hat viele Veranstaltungen; die Liste
    // bekommt hier nur die neue (vor dem Anlegen also gar keine).
    await adminPage.route(/\/organizations\/[^/]+\/events(\?.*)?$/, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const json = await response.json();
      json.data = (json.data ?? []).filter((event: { name: string }) => event.name === eventName);
      await route.fulfill({ response, json });
    });
    const eventsPage = new EventsPage(adminPage);
    await eventsPage.goto();
    await eventsPage.createEvent({ name: eventName, startDate: '2026-03-01' });
    await expect(adminPage.getByRole('main').getByRole('row')).toHaveCount(2); // Kopf + eine Zeile

    const row = eventsPage.row(eventName);
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    const menu = row.getByRole('menu');
    await expect(menu).toBeVisible();

    // Das ganze Menü liegt innerhalb der abschneidenden Karte.
    const card = await adminPage.locator('.app-card', { has: row }).boundingBox();
    const box = await menu.boundingBox();
    expect(card && box).toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(card!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(card!.y + card!.height);

    // Der letzte Punkt ist wirklich anklickbar (nicht verdeckt/abgeschnitten).
    await menu.getByRole('menuitem', { name: 'Löschen' }).click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
  });
});
