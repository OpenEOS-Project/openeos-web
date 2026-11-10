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
 * Beleg ausgeben nach der Zahlung (Belegausgabepflicht § 146a Abs. 2 AO):
 * QR-Code steht sofort da, E-Mail und Drucken daneben, „Kein Beleg“
 * schließt nur. Der QR-Code führt auf die öffentliche Beleg-Seite mit PDF.
 * Aus dem Verlauf lässt sich der Beleg später neu ausgeben.
 *
 * Bildschirmfotos: RECEIPT_SHOTS=<Ordner> (Telefon, Tablet, Desktop).
 */
test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.RECEIPT_SHOTS;
const PRODUCTS = { wurst: 'Bratwurst', schorle: 'Apfelschorle' } as const;

let admin: PosAdmin;
let device: PairedDevice;

test.beforeAll(async () => {
  admin = await posAdmin();
  await createPosEvent(admin, {
    name: `Beleg ${Date.now()}`,
    tables: { mode: 'free' },
    orderingMode: 'immediate',
    products: [
      { name: PRODUCTS.wurst, price: 3.5 },
      { name: PRODUCTS.schorle, price: 2.5 },
    ],
  });
  device = await pairPosDevice(admin, 'Beleg 1', { serviceMode: 'counter' });
});

test.afterAll(async () => {
  await admin.api.dispose();
});

async function shot(page: import('@playwright/test').Page, name: string, project: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png`, fullPage: false });
}

test.describe('POS - receipt handout', () => {
  test.beforeEach(async ({ page }) => {
    await installDevice(page, device);
  });

  test('shows the QR code right after payment, e-mails the receipt and opens the public page', async ({
    page,
    context,
  }, testInfo) => {
    const project = testInfo.project.name;
    const pos = new POSPage(page);
    await pos.goto();
    await pos.addProduct(PRODUCTS.wurst);
    await pos.addProduct(PRODUCTS.schorle);
    await pos.checkout();
    await pos.payCash('Passend');
    await pos.completePayment();

    const done = pos.doneSheet;
    const qr = done.getByTestId('receipt-handout-qr');
    await expect(qr.getByRole('img', { name: 'QR-Code zum Beleg' })).toBeVisible();
    await expect(qr).toContainText('Link gültig bis');
    await expect(done.getByRole('button', { name: 'E-Mail' })).toBeVisible();
    await expect(done.getByRole('button', { name: 'Kein Beleg' })).toBeVisible();
    await qr.scrollIntoViewIfNeeded();
    await shot(page, '01-abschluss-qr', project);

    // Link aus dem QR-Code (gleicher Wert wie im SVG-Titel nicht lesbar —
    // die Kasse holt ihn per API; hier aus der Antwort mitschneiden).
    const linkResponse = page.waitForResponse(/\/device-api\/receipts\/email$/);
    await done.getByRole('button', { name: 'E-Mail' }).click();
    const form = done.getByTestId('receipt-handout-email');
    await form.getByLabel('E-Mail-Adresse des Gastes').fill('kein-at');
    await form.getByRole('button', { name: 'Beleg senden' }).click();
    await expect(form).toContainText('gültige E-Mail-Adresse');
    await shot(page, '02-email-fehler', project);
    await form.getByLabel('E-Mail-Adresse des Gastes').fill(`gast-${project}@example.org`);
    await form.getByRole('button', { name: 'Beleg senden' }).click();
    expect((await linkResponse).status()).toBe(200);
    await expect(page.getByText('Beleg per E-Mail verschickt')).toBeVisible();
    await expect(qr).toBeVisible();

    await done.getByRole('button', { name: 'Nächster Bon' }).click();
    await expect(done).toHaveCount(0);

    // Verlauf → Beleg → QR-Code → öffentliche Seite
    await pos.openMenu('Bestellverlauf');
    const history = page.getByRole('dialog', { name: 'Bestellverlauf' });
    await history.locator('.pos-oh-row').first().click();
    const linkCreated = page.waitForResponse(/\/device-api\/receipts\/link$/);
    await page.getByTestId('order-receipt').click();
    const { data } = (await (await linkCreated).json()) as { data: { url: string } };
    const sheet = page.getByRole('dialog', { name: 'Beleg ausgeben' });
    await expect(sheet.getByRole('img', { name: 'QR-Code zum Beleg' })).toBeVisible();
    await shot(page, '03-verlauf-beleg', project);

    const token = data.url.split('/beleg/')[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const guest = await context.newPage();
    await guest.goto(`/beleg/${token}`);
    await expect(guest.getByRole('heading', { name: 'Dein Beleg' })).toBeVisible();
    const paper = guest.locator('.receipt-public__paper');
    await expect(paper).toContainText(PRODUCTS.wurst);
    await expect(paper).toContainText('GESAMT');
    await expect(paper).toContainText('Zahlungsart');
    await expect(guest.getByTestId('receipt-pdf')).toHaveAttribute('href', /\/public\/receipts\/.+\/pdf$/);
    const pdf = await guest.request.get(
      (await guest.getByTestId('receipt-pdf').getAttribute('href')) as string,
    );
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await shot(guest, '04-beleg-seite', project);

    await guest.goto('/beleg/AAAAAAAAAAAAAAAAAAAAAA');
    await expect(guest.locator('.receipt-public__state[role=alert]')).toContainText('nicht (mehr) verfügbar');
    await shot(guest, '05-beleg-abgelaufen', project);
    await guest.close();
  });

  test('„Kein Beleg“ only closes the sheet', async ({ page }) => {
    const pos = new POSPage(page);
    await pos.goto();
    await pos.addProduct(PRODUCTS.schorle);
    await pos.checkout();
    await pos.payCash('Passend');
    await pos.completePayment();
    await expect(pos.doneSheet.getByRole('img', { name: 'QR-Code zum Beleg' })).toBeVisible();
    await pos.doneSheet.getByRole('button', { name: 'Kein Beleg' }).click();
    await expect(pos.doneSheet).toHaveCount(0);
  });
});
