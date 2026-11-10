import { expect, test } from '@playwright/test';

import {
  createPosEvent,
  installDevice,
  pairPosDevice,
  posAdmin,
  type PairedDevice,
  type PosAdmin,
} from '../fixtures/pos';
import { POSPage } from '../pages/pos.page';

/*
 * Bewirtungsbeleg an der Kasse (openeos-web#9): ohne Stammdaten des Vereins
 * ein klarer Hinweis, über 250 € Name des Bewirtenden Pflicht, Nummer
 * B-JJJJ-NNNN, Ausgabe als QR-Code, aus dem Verlauf als Kopie.
 *
 * Bildschirmfotos: RECEIPT_SHOTS=<Ordner>.
 */
test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.RECEIPT_SHOTS;
const MENU = 'Festmenü für 10 Personen';

let admin: PosAdmin;
let device: PairedDevice;

async function setMasterData(values: Record<string, unknown>) {
  const res = await admin.api.get(`organizations/${admin.organizationId}`, { headers: admin.headers });
  const org = (await res.json()).data as { settings: Record<string, unknown> };
  const patch = await admin.api.patch(`organizations/${admin.organizationId}`, {
    headers: admin.headers,
    data: { settings: { ...org.settings, ...values } },
  });
  expect(patch.ok()).toBe(true);
}

test.beforeAll(async () => {
  admin = await posAdmin();
  await createPosEvent(admin, {
    name: `Bewirtung ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'immediate',
    products: [{ name: MENU, price: 320 }],
  });
  device = await pairPosDevice(admin, 'Bewirtung 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

test('issues a Bewirtungsbeleg after payment and hands it out again as a copy', async ({
  page,
  context,
}, testInfo) => {
  const project = testInfo.project.name;
  const shot = async (p: typeof page, name: string) => {
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
  };
  await setMasterData({ legalName: '', taxNumber: '' });
  await installDevice(page, device);
  const pos = new POSPage(page);
  await pos.goto();
  await pos.addProduct(MENU);
  await pos.checkout();
  await pos.payCash('Passend');
  await pos.completePayment();

  const done = pos.doneSheet;
  await done.getByTestId('receipt-hospitality').click();
  const panel = done.getByTestId('hospitality-panel');
  await expect(panel.getByTestId('hospitality-master-data')).toContainText('offizieller Name');
  await expect(panel.getByRole('button', { name: 'Bewirtungsbeleg ausstellen' })).toBeDisabled();
  await panel.scrollIntoViewIfNeeded();
  await shot(page, '11-bewirtung-stammdaten-fehlen');

  await setMasterData({
    legalName: 'E2E Verein e.V.',
    taxNumber: '12/345/67890',
    address: { street: 'Festplatz 1', zip: '12345', city: 'Musterdorf', country: 'DE' },
  });
  await panel.getByRole('button', { name: 'Zurück' }).click();
  await done.getByTestId('receipt-hospitality').click();
  await expect(panel.getByTestId('hospitality-master-data')).toHaveCount(0);
  await expect(panel).toContainText('Rechnungsbetrag 320,00');
  await panel.getByRole('button', { name: 'Bewirtungsbeleg ausstellen' }).click();
  await expect(panel).toContainText('Über 250 € muss der Name des Bewirtenden');
  await panel.getByLabel('Name / Firma des Bewirtenden').fill('Muster Maschinenbau GmbH');
  await panel.getByLabel('Anschrift (optional)').fill('Industriestraße 12\n12345 Musterstadt');
  await shot(page, '12-bewirtung-formular');
  await panel.getByRole('button', { name: 'Bewirtungsbeleg ausstellen' }).click();
  const issued = panel.getByTestId('hospitality-issued');
  await expect(issued).toContainText(/Bewirtungsbeleg B-\d{4}-\d{4}/);
  const number = (await issued.textContent())!.match(/B-\d{4}-\d{4}/)![0];
  await panel.getByRole('button', { name: 'QR-Code' }).click();
  await expect(panel.getByRole('img', { name: 'QR-Code zum Bewirtungsbeleg' })).toBeVisible();
  await shot(page, '13-bewirtung-ausgestellt-qr');
  await done.getByRole('button', { name: 'Nächster Bon' }).click();

  // Verlauf → Beleg → Bewirtungsbeleg: derselbe Beleg, jetzt als Kopie.
  await pos.openMenu('Bestellverlauf');
  const history = page.getByRole('dialog', { name: 'Bestellverlauf' });
  await history.locator('.pos-oh-row').first().click();
  await page.getByTestId('order-receipt').click();
  const sheet = page.getByRole('dialog', { name: 'Beleg ausgeben' });
  await sheet.getByTestId('receipt-hospitality').click();
  await expect(sheet.getByTestId('hospitality-issued')).toContainText(number);
  const linkResponse = page.waitForResponse(/\/hospitality-receipts\/[^/]+\/link$/);
  await sheet.getByRole('button', { name: 'QR-Code' }).click();
  const { data } = (await (await linkResponse).json()) as { data: { url: string; copy: boolean } };
  expect(data.copy).toBe(true);

  const guest = await context.newPage();
  await guest.goto(`/beleg/${data.url.split('/beleg/')[1]}`);
  await expect(guest.getByRole('heading', { name: 'Bewirtungsbeleg' })).toBeVisible();
  const paper = guest.locator('.receipt-public__paper');
  for (const text of [
    'BEWIRTUNGSBELEG',
    'KOPIE',
    number,
    'E2E Verein e.V.',
    'Steuernummer: 12/345/67890',
    'Tag der Bewirtung',
    'Muster Maschinenbau GmbH',
    MENU,
    'Anlass der Bewirtung',
    'Unterschrift des Bewirtenden',
  ]) {
    await expect(paper).toContainText(text);
  }
  await shot(guest, '14-bewirtung-seite');
  await guest.close();
});
