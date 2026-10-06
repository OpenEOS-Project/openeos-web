import { defineConfig } from '@playwright/test';

/**
 * Unit-Tests ohne Browser und ohne Server (`pnpm test:unit`).
 *
 * Laufen mit dem Testrunner von Playwright, der ohnehin installiert ist und
 * TypeScript samt `@/`-Pfaden versteht — ein zweiter Testrunner waere nur
 * fuer reine Funktionen zu viel. Zeitzonenabhaengige Tests setzen
 * process.env.TZ selbst (siehe tests/unit/helpers.ts); Node uebernimmt die
 * Zone sofort.
 */
export default defineConfig({
  testDir: './tests/unit',
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Ein Worker: die Tests wechseln process.env.TZ und duerfen sich dabei
  // nicht ueberholen.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
});
