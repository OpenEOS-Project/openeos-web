import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Konfiguration fuer die E2E-Suite.
 *
 * Die Suite braucht eine laufende API im Modus DEPLOYMENT_MODE=selfhosted
 * (Adresse in API_URL, Standard http://localhost:3001). Den Rest richtet
 * e2e/global-setup.ts selbst ein — siehe dort.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.BASE_URL || 'http://localhost:3002';
const port = new URL(baseURL).port || '3002';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  // Keine Wiederholungen: ein Test, der erst im zweiten Anlauf besteht, ist
  // ein Befund und kein Erfolg. Wackelt etwas, gehoert die Wartebedingung
  // repariert, nicht die Zahl der Versuche erhoeht.
  retries: 0,
  // Ein Worker, der Reihe nach: alle Tests teilen sich eine Organisation,
  // und dort ist hoechstens eine Veranstaltung aktiv. Parallel schaltete der
  // Veranstaltungstest der Kasse ihre Veranstaltung unter den Fuessen weg.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },

  // Nur Chromium. Firefox, WebKit und die Mobilprofile standen hier frueher
  // auch, liefen aber nie — und die Kassen laufen in der Praxis auf
  // Chromium-basierten Tablets. Fuer die Kasse kommen Tablet- und
  // Telefongroesse als eigene Projekte dazu.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Kasse auf Tablet (hochkant) und Telefon — beide noch Chromium, die
    // Kassen-Tablets laufen damit. Nur die Kassen-Tests (Breakpoints
    // kompakt ≤ 820 px).
    {
      name: 'pos-tablet',
      testMatch: 'pos/**',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'pos-phone',
      testMatch: 'pos/**',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],

  // In der CI startet der fertige Produktions-Build (derselbe Server wie im
  // Image); lokal der Entwicklungsserver, sofern nicht schon einer laeuft.
  webServer: {
    command: process.env.CI ? 'node .next/standalone/server.js' : 'pnpm dev',
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      PORT: port,
      // Nicht 127.0.0.1: next-intl schreibt Pfade ohne Sprachpraefix intern
      // auf "localhost" um (x-middleware-rewrite). Lauscht der Server nur
      // auf 127.0.0.1, endete jede solche Seite in einer Weiterleitung auf
      // sich selbst. Das Image setzt ebenfalls 0.0.0.0.
      HOSTNAME: '0.0.0.0',
      API_URL: process.env.API_URL || 'http://localhost:3001',
    },
  },

  globalSetup: './e2e/global-setup.ts',

  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
});
