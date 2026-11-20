import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { type PairedDevice, type PosAdmin, createPosEvent, installDevice, pairPosDevice, posAdmin } from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Druck-Zustand an der Kasse: warten Bons der eigenen Drucker länger als
 * 30 s (oder sind fehlgeschlagen), zeigt der Kopf einen Hinweis; Tippen
 * öffnet den Verlauf zum Nachdrucken. Der Zustand kommt aus
 * `GET /device-api/status` (`printHealth`) und ist hier nachgebildet — so
 * braucht der Test weder Drucker noch Agent.
 */
test.describe.configure({ mode: 'serial' });

let admin: PosAdmin;
let device: PairedDevice;

test.beforeAll(async () => {
  admin = await posAdmin();
  await createPosEvent(admin, {
    name: `Druck ${Date.now()}`,
    tables: { mode: 'none' },
    orderingMode: 'immediate',
    products: [{ name: 'Bratwurst', price: 4 }],
  });
  device = await pairPosDevice(admin, 'Druck 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

function printHealth(waitingJobs: number) {
  return {
    status: waitingJobs > 0 ? 'error' : 'ok',
    checkedAt: new Date().toISOString(),
    waitingJobs,
    failedJobs: 0,
    oldestWaitingAt: waitingJobs > 0 ? new Date(Date.now() - 90_000).toISOString() : null,
    offlineAgents: waitingJobs > 0 ? [{ deviceId: 'agent-1', name: 'Pi Küche', printerIds: ['p-1'] }] : [],
    printers:
      waitingJobs > 0
        ? [
            {
              printerId: 'p-1',
              name: 'Küchendrucker',
              agentDeviceId: 'agent-1',
              agentName: 'Pi Küche',
              agentOnline: false,
              printerOnline: false,
              waitingJobs,
              oldestWaitingAt: new Date(Date.now() - 90_000).toISOString(),
              failedJobs: 0,
              issues: ['agent_offline', 'jobs_waiting'],
            },
          ]
        : [],
    thresholds: { waitingSeconds: 30, failedWindowMinutes: 15 },
  };
}

/** Echte Antwort der API, nur `printHealth` ersetzt. */
async function mockPrintHealth(page: Page, waitingJobs: number) {
  await page.route(/\/device-api\/status(\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { data: Record<string, unknown> };
    body.data.printHealth = printHealth(waitingJobs);
    await route.fulfill({ response, json: body });
  });
}

test.describe('POS - print health', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('shows waiting tickets in the header and opens the history to reprint', async ({ page }) => {
    await mockPrintHealth(page, 3);
    const pos = new POSPage(page);
    await pos.goto();

    const warning = page.getByTestId('pos-print-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveAccessibleName(/3 Bons warten\. Küchendrucker offline\./);

    await warning.click();
    await expect(page.getByRole('dialog', { name: 'Bestellverlauf' })).toBeVisible();
  });

  test('stays quiet while everything prints', async ({ page }) => {
    await mockPrintHealth(page, 0);
    const pos = new POSPage(page);
    await pos.goto();
    await expect(page.locator('.pos-head')).toBeVisible();
    await expect(page.getByTestId('pos-print-warning')).toHaveCount(0);
  });
});
