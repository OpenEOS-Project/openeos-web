import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiLogin, apiPost, ensureOk, newApiContext } from '../fixtures/api';
import { loginAs } from '../fixtures/auth.fixture';
import { TEST_ADMIN } from '../fixtures/test-data';

/*
 * Verwaltung der Tische (Spezifikation §4, §5.6): Bereich anlegen, Serie,
 * Tisch auf der Karte ziehen (Autosave), umbenennen, Löschen mit offenen
 * Bestellungen, Tischmodus im Veranstaltungsdialog, Telefon ohne Editor.
 *
 * Bezeichnungen sind org-weit eindeutig und die Suite läuft lokal mehrfach
 * gegen dieselbe Datenbank — daher ein Präfix je Lauf. Seriell, weil die
 * Tests auf dem Bereich des ersten aufbauen.
 */
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36).slice(-4).toUpperCase();
const AREA = `Zelt ${stamp}`;
const PREFIX = `${stamp}-`;
const label = (n: number) => `${PREFIX}${String(n).padStart(2, '0')}`;

interface ApiTable {
  id: string;
  label: string;
  x: number;
  y: number;
  areaId: string;
}
interface ApiArea {
  id: string;
  name: string;
  tables: ApiTable[];
}

let api: APIRequestContext;
let admin: { headers: Record<string, string>; organizationId: string | undefined };

test.beforeAll(async () => {
  api = await newApiContext();
  admin = await apiLogin(api, TEST_ADMIN.email, TEST_ADMIN.password);
});

test.afterAll(async () => {
  await api.dispose();
});

async function areasFromApi(): Promise<ApiArea[]> {
  const res = await api.get(`organizations/${admin.organizationId}/table-areas`, { headers: admin.headers });
  await ensureOk(res, 'Bereiche laden');
  return (await res.json()).data as ApiArea[];
}

async function tableFromApi(tableLabel: string): Promise<ApiTable | undefined> {
  return (await areasFromApi()).flatMap((a) => a.tables).find((t) => t.label === tableLabel);
}

async function openTables(page: Page) {
  await loginAs(page, TEST_ADMIN);
  await page.goto('/tables');
  await expect(page.getByRole('heading', { name: 'Tische', level: 1 })).toBeVisible();
}

async function selectArea(page: Page) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${AREA}`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test.describe('Tische', () => {
  test('legt einen Bereich an', async ({ page }) => {
    await openTables(page);

    // Leere Organisation: Leerzustand; sonst der Knopf neben den Reitern.
    await page
      .getByRole('button', { name: 'Bereich anlegen' })
      .or(page.getByRole('button', { name: 'Bereich hinzufügen' }))
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(AREA);
    await dialog.getByRole('button', { name: 'Erstellen' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByRole('tab', { name: new RegExp(`^${AREA}`) })).toHaveAttribute('aria-selected', 'true');
    expect((await areasFromApi()).some((a) => a.name === AREA)).toBe(true);
  });

  test('legt eine Serie an und markiert Kollisionen', async ({ page }) => {
    await openTables(page);
    await selectArea(page);

    await page.getByRole('button', { name: 'Serie anlegen' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Präfix').fill(PREFIX);
    await dialog.getByLabel('Start').fill('1');
    await dialog.getByLabel('Anzahl').fill('12');
    await dialog.getByLabel('Stellen').fill('2');
    await expect(dialog.getByRole('list', { name: 'Vorschau' }).getByRole('listitem')).toHaveCount(12);
    await expect(dialog.getByText(label(1), { exact: true })).toBeVisible();
    await expect(dialog.getByText(label(12), { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '12 Tische anlegen' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('12 Tische angelegt')).toBeVisible();

    const area = (await areasFromApi()).find((a) => a.name === AREA)!;
    expect(area.tables.map((t) => t.label)).toEqual(Array.from({ length: 12 }, (_, i) => label(i + 1)));

    // Dieselbe Serie noch einmal: alles belegt, Anlegen gesperrt.
    await page.getByRole('button', { name: 'Serie anlegen' }).click();
    await dialog.getByLabel('Präfix').fill(PREFIX);
    await dialog.getByLabel('Anzahl').fill('3');
    await expect(dialog.getByRole('listitem', { name: `${label(1)}, gibt es schon` })).toBeVisible();
    await expect(dialog.getByText(/Diese Bezeichnungen gibt es schon/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: '3 Tische anlegen' })).toBeDisabled();
  });

  test('speichert einen gezogenen Tisch automatisch', async ({ page }) => {
    await openTables(page);
    await selectArea(page);

    const before = await tableFromApi(label(1));
    const table = page.getByRole('button', { name: new RegExp(`^Tisch ${label(1)}`) });
    const box = (await table.boundingBox())!;

    // Pointer-Ziehen wie mit Maus oder Finger.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 160, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator('.tables-toolbar__status')).toHaveText('Gespeichert', { timeout: 10_000 });
    await expect
      .poll(async () => {
        const after = await tableFromApi(label(1));
        return after && (after.x !== before!.x || after.y !== before!.y);
      })
      .toBe(true);

    // Nach dem Neuladen steht der Tisch an der neuen Stelle.
    const saved = (await tableFromApi(label(1)))!;
    await page.reload();
    await selectArea(page);
    const moved = (await page.getByRole('button', { name: new RegExp(`^Tisch ${label(1)}`) }).boundingBox())!;
    expect(Math.abs(moved.x - box.x)).toBeGreaterThan(40);
    expect(saved.y).toBeGreaterThan(before!.y);

    // Tastatur: Pfeil nach links verschiebt um ein Raster.
    await page.getByRole('button', { name: new RegExp(`^Tisch ${label(1)}`) }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await tableFromApi(label(1)))!.x).toBe(saved.x - 20);
  });

  test('benennt einen Tisch im Inspektor um', async ({ page }) => {
    await openTables(page);
    await selectArea(page);

    await page.getByRole('button', { name: new RegExp(`^Tisch ${label(2)}`) }).click();
    const inspector = page.getByRole('complementary', { name: 'Eigenschaften' });
    await expect(inspector.getByRole('heading', { name: `Tisch ${label(2)}` })).toBeVisible();

    const renamed = `${PREFIX}B2`;
    await inspector.getByLabel('Bezeichnung').fill(renamed);
    await inspector.getByLabel('Bezeichnung').press('Enter');
    await expect(inspector.getByRole('heading', { name: `Tisch ${renamed}` })).toBeVisible();
    await expect.poll(async () => Boolean(await tableFromApi(renamed))).toBe(true);
  });

  test('zeigt beim Löschen mit offenen Bestellungen einen Hinweis', async ({ page }) => {
    await openTables(page);
    await selectArea(page);

    // Eine Bestellung mit Tisch-ID legt erst die Kasse an (P2b); hier
    // antwortet die API so, wie sie es bei offenen Bestellungen tut.
    await page.route('**/api/organizations/*/tables/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'CONFLICT',
            reason: 'TABLE_HAS_OPEN_ORDERS',
            message: 'An diesem Tisch ist noch eine Bestellung offen. Kassiere sie zuerst ab.',
            params: { count: 1 },
          },
        }),
      });
    });

    await page.getByRole('button', { name: new RegExp(`^Tisch ${label(3)}`) }).click();
    await page.getByRole('complementary', { name: 'Eigenschaften' }).getByRole('button', { name: 'Löschen' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: `Tisch ${label(3)} löschen?` })).toBeVisible();
    await dialog.getByRole('button', { name: 'Löschen' }).click();

    await expect(page.getByText('An diesem Tisch sind noch Bestellungen offen. Kassiere sie zuerst ab.')).toBeVisible();
    expect(await tableFromApi(label(3))).toBeTruthy();
  });

  test('löscht einen Tisch über die Liste', async ({ page }) => {
    await openTables(page);
    await page.getByRole('button', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: `Tisch ${label(12)} löschen` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByText(`Tisch ${label(12)} gelöscht`)).toBeVisible();
    await expect.poll(async () => Boolean(await tableFromApi(label(12)))).toBe(false);
  });

  test('stellt im Veranstaltungsdialog vordefinierte Tische ein', async ({ page }) => {
    const org = admin.organizationId;
    const eventName = `Tischfest ${stamp}`;
    const event = await apiPost(api, `organizations/${org}/events`, admin.headers, {
      name: eventName,
      startDate: '2026-03-01',
    });
    const area = (await areasFromApi()).find((a) => a.name === AREA)!;

    await loginAs(page, TEST_ADMIN);
    await page.goto('/events');
    const row = page.getByRole('row').filter({ hasText: eventName });
    await row.getByRole('button', { name: 'Bearbeiten' }).click();

    const dialog = page.getByRole('dialog');
    const mode = dialog.getByLabel('Tische', { exact: true });
    await expect(mode).toHaveValue('free');
    await mode.selectOption('predefined');
    // Die Kästchen aus @openeos/ui sind gestaltet; geklickt wird die Beschriftung.
    await dialog.locator('label', { hasText: 'Alle Bereiche' }).click();
    await expect(dialog.getByLabel('Alle Bereiche')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    // Ohne Bereich nicht speicherbar.
    await expect(dialog.getByText('Wähl mindestens einen Bereich.')).toBeVisible();
    await dialog.locator('label', { hasText: AREA }).click();
    await expect(dialog.getByLabel(new RegExp(`^${AREA}`))).toBeChecked();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);

    const res = await api.get(`organizations/${org}/events/${event.id}`, { headers: admin.headers });
    await ensureOk(res, 'Veranstaltung laden');
    const settings = (await res.json()).data.settings;
    expect(settings.tables).toEqual({ mode: 'predefined', areaIds: [area.id] });
  });

  test('zeigt auf dem Telefon die Liste statt des Editors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTables(page);
    await selectArea(page);

    await expect(page.getByText('Karte am Tablet oder PC bearbeiten', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: `Bezeichnung von Tisch ${label(4)}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Karte', exact: true })).toHaveCount(0);
    // Die Vorschau ist nicht bearbeitbar: Tische sind dort normale Knöpfe ohne Griff.
    await expect(page.locator('.oe-floor--edit')).toHaveCount(0);
  });
});
