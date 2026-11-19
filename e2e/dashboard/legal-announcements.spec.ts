import type { Page, Request } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { loginAs } from '../fixtures/auth.fixture';
import { TEST_ADMIN } from '../fixtures/test-data';

/*
 * Ankündigung neuer Rechtstexte, API-Antworten nachgestellt: Die E2E-API
 * läuft eigenständig (selfhosted) – dort gelten die Texte von LUXCODE
 * nicht, die Endpunkte antworten mit 404. Geprüft wird die Oberfläche:
 * Hinweis für Admins (ausblendbar) und die Super-Admin-Seite mit Vorschau
 * und Versand.
 */

const SITE = 'https://openeos.example';
const doc = (path: string, version: string) => ({
  version,
  url: `${SITE}/${path}`,
  versionUrl: `${SITE}/${path}/${version}`,
  pdfUrl: `${SITE}/rechtstexte/${path}-${version}.pdf`,
});

async function mockLegal(page: Page) {
  await page.route('**/api/legal/versions', (route) =>
    route.fulfill({
      json: {
        data: {
          enabled: true,
          siteUrl: SITE,
          documents: {
            agb: doc('agb', '2026-11-18'),
            avv: doc('avv', '2026-11-18'),
            privacy: doc('datenschutz', '2026-11-18'),
            imprint: doc('impressum', '2026-11-12'),
            anlage1: doc('leistungsbeschreibung', '2026-11-18'),
          },
          platform: null,
          tseConditions: null,
        },
      },
    })
  );
}

test.describe('Legal text announcements', () => {
  test('admins see an upcoming change and can hide it', async ({ page }) => {
    await mockLegal(page);
    const dismissed: string[] = [];
    await page.route('**/api/legal/announcements', (route) =>
      route.fulfill({
        json: {
          data: dismissed.length
            ? []
            : [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  documents: ['agb'],
                  version: '2027-01-15',
                  summaryDe: 'Ziffer 5 wird klarer gefasst.',
                  summaryEn: null,
                  explicitConsent: false,
                  announcedAt: '2026-11-18T10:00:00.000Z',
                  links: {
                    agb: {
                      versionUrl: `${SITE}/agb/2027-01-15`,
                      pdfUrl: `${SITE}/rechtstexte/agb-2027-01-15.pdf`,
                      previousUrl: `${SITE}/agb/2026-11-18`,
                    },
                  },
                },
              ],
        },
      })
    );
    await page.route('**/api/legal/announcements/*/dismiss', (route) => {
      dismissed.push(route.request().url());
      return route.fulfill({ status: 204 });
    });

    await loginAs(page, TEST_ADMIN);
    const banner = page.getByTestId('legal-announcement-banner');
    await expect(banner).toContainText('AGB: neue Fassung ab 15. Januar 2027');

    await banner.getByRole('button', { name: 'Was ändert sich?' }).click();
    await expect(banner).toContainText('Ziffer 5 wird klarer gefasst.');
    await expect(banner.getByRole('link', { name: /AGB: neue Fassung/ })).toHaveAttribute(
      'href',
      `${SITE}/agb/2027-01-15`
    );
    await expect(banner).toContainText('innerhalb von sechs Wochen');

    await banner.getByRole('button', { name: 'Hinweis ausblenden' }).click();
    await expect(banner).toHaveCount(0);
    expect(dismissed).toEqual([
      expect.stringContaining('/legal/announcements/11111111-1111-4111-8111-111111111111/dismiss'),
    ]);
  });

  test('super admin previews and announces a new version', async ({ page }) => {
    await mockLegal(page);
    await page.route('**/api/legal/announcements', (route) =>
      route.fulfill({ json: { data: [] } })
    );

    const announcements: Record<string, unknown>[] = [];
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const body = (request: Request) => request.postDataJSON() as Record<string, unknown>;

    await page.route('**/api/admin/legal-announcements', async (route) => {
      if (route.request().method() === 'POST') {
        sent.push({ url: route.request().url(), body: body(route.request()) });
        const created = {
          id: '22222222-2222-4222-8222-222222222222',
          documents: ['agb'],
          version: '2027-01-15',
          previousVersions: { agb: '2026-11-18' },
          summaryDe: 'Ziffer 5 wird klarer gefasst.',
          summaryEn: null,
          shortNotice: false,
          explicitConsent: false,
          createdAt: '2026-11-18T10:00:00.000Z',
          createdByEmail: TEST_ADMIN.email,
          inForce: false,
          stats: { total: 3, pending: 0, sending: 0, sent: 3, failed: 0 },
          failures: [],
        };
        announcements.push(created);
        return route.fulfill({ status: 201, json: { data: created } });
      }
      return route.fulfill({
        json: {
          data: {
            initialVersion: '2026-11-18',
            siteUrl: SITE,
            versions: {
              agb: '2026-11-18',
              anlage1: '2026-11-18',
              avv: '2026-11-18',
              privacy: '2026-11-18',
              imprint: '2026-11-12',
            },
            today: '2026-11-18',
            noticeDays: 42,
            earliestContractVersion: '2026-12-30',
            avvAnnexNoticeDays: 28,
            earliestAvvAnnexVersion: '2026-12-16',
            emailEnabled: true,
            contactEmail: 'hello@openeos.de',
            recipients: 3,
            announcements,
          },
        },
      });
    });
    let previews = 0;
    await page.route('**/api/admin/legal-announcements/preview', async (route) => {
      previews++;
      sent.push({ url: route.request().url(), body: body(route.request()) });
      const tooEarly = (body(route.request()).version as string) < '2026-12-30';
      return route.fulfill({
        json: {
          data: {
            valid: !tooEarly,
            problems: tooEarly
              ? [
                  {
                    field: 'version',
                    message: 'AGB müssen mindestens sechs Wochen vorher angekündigt werden.',
                  },
                ]
              : [],
            subject: 'Neue Fassung: AGB ab 15. Januar 2027',
            html: '<html><body><h1>Wir passen unsere Rechtstexte an.</h1></body></html>',
            recipients: 3,
            previousVersions: { agb: '2026-11-18' },
          },
        },
      });
    });

    await loginAs(page, TEST_ADMIN);
    await page.goto('/admin/legal');
    await expect(page.getByRole('heading', { name: 'Rechtstexte', level: 1 })).toBeVisible();
    await expect(page.getByText('Noch keine Ankündigung.')).toBeVisible();

    // AVV: Zustimmung nach Ziffer 12.4, ausser nur Anhang B/C (Ziffer 6.3).
    const avv = page
      .getByRole('group', { name: 'Geänderte Dokumente' })
      .getByText('Auftragsverarbeitungsvertrag (AVV)', { exact: true });
    await avv.click();
    await expect(page.getByTestId('admin-legal-avv-hint')).toContainText('AVV Ziffer 12.4');
    await page.getByText('Nur Anhang B/C geändert (Verfahren nach AVV Ziffer 6.3)').click();
    await expect(page.getByTestId('admin-legal-avv-hint')).toContainText('vier Wochen');
    await expect(page.getByText('frühestens zum 16. Dezember 2026')).toBeVisible();
    await avv.click();
    await expect(page.getByTestId('admin-legal-avv-hint')).toHaveCount(0);

    await page
      .getByRole('group', { name: 'Geänderte Dokumente' })
      .getByText('AGB', { exact: true })
      .click();
    await expect(page.getByTestId('admin-legal-doc-agb')).toBeChecked();
    await expect(page.getByText('frühestens zum 30. Dezember 2026')).toBeVisible();
    await page.getByTestId('admin-legal-version').fill('2026-12-01');
    await page.getByTestId('admin-legal-summary-de').fill('Ziffer 5 wird klarer gefasst.');
    await page.getByTestId('admin-legal-preview').click();
    await expect(page.getByTestId('admin-legal-problems')).toContainText('sechs Wochen');
    await expect(page.getByTestId('admin-legal-send')).toBeDisabled();

    await page.getByTestId('admin-legal-version').fill('2027-01-15');
    await expect(page.getByText('Du hast etwas geändert')).toBeVisible();
    await page.getByTestId('admin-legal-preview').click();
    await expect(page.getByText('Die Mail geht an 3 Admins')).toBeVisible();
    await expect(page.getByTestId('admin-legal-mail')).toBeVisible();
    expect(previews).toBe(2);

    await page.getByTestId('admin-legal-send').click();
    await page.getByRole('button', { name: 'Jetzt ankündigen' }).click();
    await expect(page.getByTestId('admin-legal-item')).toContainText('3 von 3 Mails gesendet');

    const create = sent.find((s) => s.url.endsWith('/admin/legal-announcements'));
    expect(create?.body).toEqual({
      documents: ['agb'],
      version: '2027-01-15',
      summaryDe: 'Ziffer 5 wird klarer gefasst.',
      shortNotice: false,
      explicitConsent: false,
      avvAnnexesOnly: false,
    });
  });

  test('after the effective date the dialog names the date, the change and the right to object', async ({
    page,
  }) => {
    await mockLegal(page);
    await page.route('**/api/legal/announcements', (route) =>
      route.fulfill({ json: { data: [] } })
    );
    // Die eigenständige API fragt nie erneut – die Antworten der Anmeldung
    // und von /auth/me melden hier eine ausstehende Bestätigung.
    let required = true;
    const flag = async (route: import('@playwright/test').Route) => {
      const response = await route.fetch();
      const json = (await response.json()) as {
        data?: Record<string, unknown> & { user?: Record<string, unknown> };
      };
      if (json.data) {
        json.data.legalReacceptanceRequired = required;
        if (json.data.user) json.data.user.legalReacceptanceRequired = required;
      }
      await route.fulfill({ response, json });
    };
    await page.route('**/api/auth/login', flag);
    await page.route('**/api/auth/me', flag);
    const state = (version: string | null) => ({
      currentVersion: '2027-01-15',
      acceptedVersion: version,
      acceptedAt: version ? '2026-11-18T10:00:00.000Z' : null,
      upToDate: version === '2027-01-15',
      reacceptanceRequired: version !== '2027-01-15',
      acceptedUrl: version ? `${SITE}/agb/${version}` : null,
      acceptedPdfUrl: null,
    });
    await page.route('**/api/legal/status', (route) =>
      route.fulfill({
        json: {
          data: {
            required,
            documents: {
              agb: state('2026-11-18'),
              avv: { ...state('2027-01-15'), currentVersion: '2026-11-18' },
              anlage1: { ...state('2027-01-15'), currentVersion: '2026-11-18' },
            },
            change: {
              version: '2027-01-15',
              documents: ['agb'],
              announcedAt: '2026-11-18T10:00:00.000Z',
              summaryDe: 'Ziffer 5 wird klarer gefasst.',
              summaryEn: null,
              explicitConsent: false,
            },
          },
        },
      })
    );

    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, TEST_ADMIN);
    const dialog = page.getByTestId('legal-reacceptance-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Neue AGB' })).toBeVisible();
    await expect(dialog).toContainText('Gilt seit 15. Januar 2027');
    await expect(page.getByTestId('legal-reacceptance-summary')).toHaveText(
      'Ziffer 5 wird klarer gefasst.'
    );
    await expect(page.getByTestId('legal-reacceptance-objection')).toContainText(
      'hello@openeos.de'
    );
    // Nur das geänderte Dokument wird genannt.
    await expect(page.getByTestId('legal-reacceptance-checkbox-label')).toHaveText(
      'Ich habe die AGB gelesen und akzeptiere sie.'
    );
    await expect(dialog.getByRole('link', { name: /Auftragsverarbeitungsvertrag/ })).toHaveCount(0);

    // „Später erinnern“ schließt den Dialog für einen Tag.
    await page.getByTestId('legal-reacceptance-later').click();
    await expect(dialog).toHaveCount(0);
    required = false;
  });
  test('an AVV annex change names only the AVV and records only it', async ({ page }) => {
    await mockLegal(page);
    await page.route('**/api/legal/announcements', (route) =>
      route.fulfill({ json: { data: [] } })
    );
    let required = true;
    const flag = async (route: import('@playwright/test').Route) => {
      const response = await route.fetch();
      const json = (await response.json()) as {
        data?: Record<string, unknown> & { user?: Record<string, unknown> };
      };
      if (json.data) {
        json.data.legalReacceptanceRequired = required;
        if (json.data.user) json.data.user.legalReacceptanceRequired = required;
      }
      await route.fulfill({ response, json });
    };
    await page.route('**/api/auth/login', flag);
    await page.route('**/api/auth/me', flag);
    const state = (current: string, accepted: string) => ({
      currentVersion: current,
      acceptedVersion: accepted,
      acceptedAt: '2026-11-18T10:00:00.000Z',
      upToDate: accepted >= current,
      reacceptanceRequired: required && accepted < current,
      acceptedUrl: null,
      acceptedPdfUrl: null,
    });
    const status = () => ({
      required,
      documents: {
        agb: state('2026-11-18', '2026-11-18'),
        avv: state('2027-01-15', required ? '2026-11-18' : '2027-01-15'),
        anlage1: state('2026-11-18', '2026-11-18'),
      },
      change: {
        version: '2027-01-15',
        documents: ['avv'],
        announcedAt: '2026-11-18T10:00:00.000Z',
        summaryDe: 'Neuer Unterauftragsverarbeiter für den Mailversand.',
        summaryEn: null,
        explicitConsent: false,
        avvAnnexesOnly: true,
      },
    });
    await page.route('**/api/legal/status', (route) => route.fulfill({ json: { data: status() } }));
    const accepted: Record<string, unknown>[] = [];
    await page.route('**/api/legal/accept', (route) => {
      accepted.push(route.request().postDataJSON() as Record<string, unknown>);
      required = false;
      return route.fulfill({ json: { data: status() } });
    });

    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());
    await loginAs(page, TEST_ADMIN);
    const dialog = page.getByTestId('legal-reacceptance-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Neuer Auftragsverarbeitungsvertrag' })).toBeVisible();
    await expect(page.getByTestId('legal-reacceptance-checkbox-label')).toHaveText(
      'Ich habe den Auftragsverarbeitungsvertrag gelesen und akzeptiere ihn.'
    );
    await expect(page.getByTestId('legal-reacceptance-objection-avv')).toContainText('vier Wochen');
    await expect(page.getByTestId('legal-reacceptance-objection')).toHaveCount(0);

    await page.getByTestId('legal-reacceptance-checkbox').check();
    // Nach dem Akzeptieren lädt die App /auth/me neu – abwarten, sonst endet
    // der Test mitten in der umgeleiteten Anfrage.
    const reloaded = page.waitForResponse('**/api/auth/me');
    await page.getByTestId('legal-reacceptance-accept').click();
    await expect(dialog).toHaveCount(0);
    await reloaded;
    expect(accepted).toEqual([{ context: 'reacceptance', documents: ['avv'] }]);
  });
});
