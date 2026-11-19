import { test as base, expect } from '@playwright/test';

/**
 * Grundlage aller Specs: `test` und `expect` von Playwright, dazu das
 * Aufraeumen der Antwort-Attrappen (page.route / context.route).
 *
 * Viele Tests veraendern echte Antworten (route.fetch → route.fulfill).
 * Laeuft am Testende noch eine solche Anfrage — etwa das Neuladen einer
 * Liste nach dem letzten Klick —, schliesst Playwright den Kontext mitten
 * im Handler, und der Test schlug mit „Response has been disposed“ oder
 * „Target page, context or browser has been closed“ fehl, obwohl alles
 * Gepruefte stimmte. Deshalb werden alle Handler vor dem Schliessen
 * entfernt; Fehler aus Handlern, die dann noch laufen, zaehlen nicht mehr.
 * Fehler waehrend des Tests bleiben Fehler.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await use(context);
    // Eine Seite, die gerade zugeht, hat ohnehin keine Handler mehr.
    for (const page of context.pages()) {
      await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    }
    await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  },
});

export { expect };
