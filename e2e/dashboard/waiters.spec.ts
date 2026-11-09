import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { pairPosDevice, posAdmin } from '../fixtures/pos';

/*
 * Verwaltung „Bedienungen“: Massenanlage mit einmaliger PIN-Anzeige,
 * Bearbeiten (Rolle), neue PIN, Deaktivieren und Löschen. Läuft auf
 * Desktop; die Kassen-Projekte (Tablet/Telefon) prüfen nur die Kasse.
 * Bildschirmfotos nur mit WAITERS_SHOTS_DIR (lokale Abnahme, auch in
 * 390x844 und 768x1024).
 */
const SHOTS = process.env.WAITERS_SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test.describe('Bedienungen (Verwaltung)', () => {
  test('creates servers in bulk, shows the PINs once and manages them', async ({ adminPage: page }) => {
    const stamp = Date.now() % 100000;
    const names = [`Anna Berger ${stamp}`, `Ben Krämer ${stamp}`, `Lea Schmidt ${stamp}`];

    await page.goto('/waiters');
    await expect(page.getByRole('heading', { name: 'Bedienungen', level: 1 })).toBeVisible();
    await shot(page, '10-verwaltung-liste');

    await page.getByRole('button', { name: 'Mehrere anlegen' }).first().click();
    const bulk = page.getByRole('dialog', { name: 'Mehrere Bedienungen anlegen' });
    await expect(bulk).toBeVisible();
    await bulk.getByLabel('Gültig für').selectOption({ label: 'Ganze Organisation' });
    await bulk.getByLabel('Namen').fill(`${names[0]};Anna\n${names[1]}\n${names[2]};Lea;Schichtleitung\n${names[1]}`);
    await expect(bulk.getByTestId('waiters-bulk-summary')).toContainText('3 Bedienungen erkannt');
    await expect(bulk.getByTestId('waiters-bulk-summary')).toContainText('1 doppelter Name übersprungen');
    await shot(page, '11-verwaltung-massenanlage');
    await bulk.getByRole('button', { name: '3 Bedienungen anlegen' }).click();

    const reveal = page.getByRole('dialog', { name: '3 neue PINs' });
    await expect(reveal).toBeVisible();
    const pins = await reveal.getByTestId('pin-reveal-list').locator('.waiters-reveal__pin').allTextContents();
    expect(pins).toHaveLength(3);
    for (const pin of pins) expect(pin).toMatch(/^\d{4,6}$/);
    expect(new Set(pins).size).toBe(3);
    await shot(page, '12-verwaltung-pins-einmalig');
    await reveal.getByRole('button', { name: 'Fertig' }).click();

    const table = page.getByTestId('waiters-table');
    for (const name of names) await expect(table.getByText(name, { exact: true })).toBeVisible();
    // Die PIN steht nirgends mehr auf der Seite.
    for (const pin of pins) await expect(table).not.toContainText(pin);

    // Bearbeiten: Ben wird Schichtleitung.
    await page.getByRole('button', { name: `${names[1]} bearbeiten` }).click();
    const form = page.getByRole('dialog', { name: 'Bedienung bearbeiten' });
    await form.getByRole('radio', { name: /Schichtleitung/ }).check();
    await expect(form.getByRole('checkbox', { name: /Stornieren & Erstatten/ })).toBeChecked();
    await shot(page, '13-verwaltung-bearbeiten');
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(form).toBeHidden();
    const benRow = table.getByRole('row').filter({ hasText: names[1] });
    await expect(benRow).toContainText('Schichtleitung');

    // Neue PIN für Anna (einmalig angezeigt).
    await page.getByRole('button', { name: `Neue PIN für ${names[0]}` }).click();
    const newPin = page.getByRole('dialog', { name: 'Neue PIN' });
    await expect(newPin.locator('.waiters-reveal__pin')).toHaveText(/^\d{4,6}$/);
    await newPin.getByRole('button', { name: 'Fertig' }).click();

    // Deaktivieren und löschen (ohne Buchungen: wirklich weg).
    await page.getByRole('button', { name: `${names[2]} deaktivieren` }).click();
    const leaRow = table.getByRole('row').filter({ hasText: names[2] });
    await expect(leaRow).toContainText('Deaktiviert');
    await expect(leaRow).toContainText('Keine PIN');
    await page.getByRole('button', { name: `${names[2]} löschen` }).click();
    await page.getByRole('dialog', { name: `${names[2]} löschen?` }).getByRole('button', { name: 'Löschen' }).click();
    await expect(table.getByText(names[2], { exact: true })).toHaveCount(0);
  });

  test('device settings offer the server modes and release a PIN lock', async ({ adminPage: page }) => {
    const admin = await posAdmin();
    const device = await pairPosDevice(admin, `Kasse Bedienung ${Date.now() % 1000}`, {
      waiterMode: 'shared',
      waiterPinLockedAt: new Date().toISOString(),
    });
    await admin.api.dispose();
    await page.goto(`/devices/${device.deviceId}?tab=settings`);
    await expect(page.getByText('Bedienung & Sicherheit')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Gemeinsame Kasse/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Feste Bedienung/ })).toBeVisible();
    await expect(page.getByText(/PIN-Eingabe an diesem Gerät ist nach zu vielen Fehlversuchen gesperrt/)).toBeVisible();
    await shot(page, '14-geraet-bedienung');
    await page.getByRole('button', { name: 'PIN-Eingabe freigeben' }).click();
    await expect(page.getByText(/nach zu vielen Fehlversuchen gesperrt/)).toHaveCount(0);
  });

  test('a member without the permission cannot open the page', async ({ memberPage }) => {
    await memberPage.goto('/waiters');
    await expect(memberPage).toHaveURL(/\/dashboard$/);
  });
});
