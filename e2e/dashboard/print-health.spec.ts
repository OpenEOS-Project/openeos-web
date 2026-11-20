import { test, expect } from '../fixtures/auth.fixture';

/*
 * Druck-Zustand in der Verwaltung: Hinweis im Dashboard (mit Link zur
 * Druckerseite) und auf der Druckerseite. Die Antwort von
 * `GET …/print-jobs/health` ist nachgebildet — so braucht der Test weder
 * Drucker noch Agent.
 */
const HEALTH = {
  status: 'error',
  checkedAt: new Date().toISOString(),
  waitingJobs: 3,
  failedJobs: 0,
  oldestWaitingAt: new Date(Date.now() - 90_000).toISOString(),
  offlineAgents: [{ deviceId: 'agent-1', name: 'Pi Küche', printerIds: ['p-1'] }],
  printers: [
    {
      printerId: 'p-1',
      name: 'Küchendrucker',
      agentDeviceId: 'agent-1',
      agentName: 'Pi Küche',
      agentOnline: false,
      printerOnline: false,
      waitingJobs: 3,
      oldestWaitingAt: new Date(Date.now() - 90_000).toISOString(),
      failedJobs: 0,
      issues: ['agent_offline', 'jobs_waiting'],
    },
  ],
  thresholds: { waitingSeconds: 30, failedWindowMinutes: 15 },
};

test.describe('Print health banner', () => {
  test('dashboard warns about the offline kitchen printer and links to the printers', async ({ adminPage }) => {
    await adminPage.route(/\/print-jobs\/health$/, (route) => route.fulfill({ json: { data: HEALTH } }));
    await adminPage.goto('/dashboard');

    const banner = adminPage.getByTestId('print-health-banner');
    await expect(banner).toContainText('Küchendrucker offline – 3 Bons warten');
    await expect(banner).toContainText('Pi Küche');

    await banner.getByRole('link', { name: 'Zu den Druckern' }).click();
    await expect(adminPage).toHaveURL(/\/printers$/);
    await expect(adminPage.getByTestId('print-health-banner')).toContainText('Küchendrucker offline');
    // Auf der Druckerseite selbst kein Link auf sich selbst.
    await expect(adminPage.getByTestId('print-health-banner').getByRole('link')).toHaveCount(0);
  });

  test('no banner while everything prints', async ({ adminPage }) => {
    await adminPage.route(/\/print-jobs\/health$/, (route) =>
      route.fulfill({
        json: { data: { ...HEALTH, status: 'ok', waitingJobs: 0, offlineAgents: [], printers: [] } },
      }),
    );
    await adminPage.goto('/dashboard');
    await expect(adminPage.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(adminPage.getByTestId('print-health-banner')).toHaveCount(0);
  });
});
