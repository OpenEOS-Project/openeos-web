import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_ADMIN, TEST_ORG, TEST_USER } from '../fixtures/test-data';
import type { Page } from '@playwright/test';

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
}

test.describe('Settings', () => {
  test.describe('Profile', () => {
    test('shows the profile of the logged-in user', async ({ adminPage }) => {
      await openSettings(adminPage);
      await expect(adminPage.getByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true');
      await expect(adminPage.getByRole('textbox', { name: 'Vorname' })).toHaveValue(TEST_ADMIN.firstName);
      await expect(adminPage.getByRole('textbox', { name: 'Nachname' })).toHaveValue(TEST_ADMIN.lastName);
      await expect(adminPage.getByRole('textbox', { name: 'E-Mail-Adresse' })).toHaveValue(TEST_ADMIN.email);
      await expect(adminPage.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeDisabled();
    });

    test('can update profile name', async ({ memberPage }) => {
      const dashboard = new DashboardPage(memberPage);
      await openSettings(memberPage);

      const firstName = memberPage.getByRole('textbox', { name: 'Vorname' });
      const save = memberPage.getByRole('button', { name: 'Änderungen speichern' });
      await expect(save).toBeDisabled();

      await firstName.fill('Moritz');
      await save.click();
      // Gespeichert ist es, wenn die Seitenleiste den neuen Namen fuehrt —
      // sie liest das Konto, das die API zurueckgegeben hat.
      await expect(dashboard.sidebar.getByRole('button', { name: /Moritz Mitglied$/ })).toBeVisible();

      await memberPage.reload();
      await expect(firstName).toHaveValue('Moritz');

      // Zuruecksetzen, damit andere Tests den bekannten Namen vorfinden.
      await firstName.fill(TEST_USER.firstName);
      await save.click();
      await expect(dashboard.sidebar.getByRole('button', { name: new RegExp(`${TEST_USER.firstName} Mitglied$`) })).toBeVisible();
    });
  });

  test.describe('Password Change', () => {
    test('rejects a too short new password', async ({ adminPage }) => {
      await openSettings(adminPage);
      await adminPage.getByRole('tab', { name: 'Konto' }).click();

      const form = adminPage.locator('form').filter({ has: adminPage.getByRole('button', { name: 'Passwort ändern' }) });
      await form.getByLabel('Aktuelles Passwort').fill(TEST_ADMIN.password);
      await form.getByLabel('Neues Passwort').fill('kurz');
      await form.getByLabel('Passwort bestätigen').fill('kurz');
      await form.getByRole('button', { name: 'Passwort ändern' }).click();

      await expect(form.getByText('Passwort muss mindestens 8 Zeichen haben')).toBeVisible();
    });

    test('rejects a mismatching confirmation', async ({ adminPage }) => {
      await openSettings(adminPage);
      await adminPage.getByRole('tab', { name: 'Konto' }).click();

      const form = adminPage.locator('form').filter({ has: adminPage.getByRole('button', { name: 'Passwort ändern' }) });
      await form.getByLabel('Aktuelles Passwort').fill(TEST_ADMIN.password);
      await form.getByLabel('Neues Passwort').fill('NeuesPasswort1!');
      await form.getByLabel('Passwort bestätigen').fill('AnderesPasswort1!');
      await form.getByRole('button', { name: 'Passwort ändern' }).click();

      await expect(form.getByText('Passwörter stimmen nicht überein')).toBeVisible();
    });
  });

  test.describe('Security', () => {
    test('shows 2FA status and the active sessions', async ({ adminPage }) => {
      await openSettings(adminPage);
      await adminPage.getByRole('tab', { name: 'Sicherheit' }).click();

      await expect(adminPage.getByRole('heading', { name: 'Zwei-Faktor-Authentifizierung' })).toBeVisible();
      await expect(adminPage.getByText('2FA ist deaktiviert')).toBeVisible();
      await expect(adminPage.getByRole('heading', { name: 'Aktive Sitzungen' })).toBeVisible();
      await expect(adminPage.getByRole('button', { name: 'Alle anderen Sitzungen beenden' })).toBeVisible();
    });
  });

  test.describe('Preferences', () => {
    test('can change theme', async ({ adminPage }) => {
      await openSettings(adminPage);
      await adminPage.getByRole('tab', { name: 'Einstellungen' }).click();
      const html = adminPage.locator('html');

      await adminPage.getByRole('button', { name: 'Dunkel' }).click();
      await expect(html).toHaveClass(/\bdark-mode\b/);

      await adminPage.getByRole('button', { name: 'Hell' }).click();
      await expect(html).toHaveClass(/\blight-mode\b/);
    });

    test('can change language', async ({ memberPage }) => {
      await openSettings(memberPage);
      await memberPage.getByRole('tab', { name: 'Einstellungen' }).click();

      await memberPage.getByRole('button', { name: 'English' }).click();
      await expect(memberPage).toHaveURL(/\/en\/settings$/);
      await expect(memberPage.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

      // Zurueck, damit die uebrigen Tests die deutsche Oberflaeche sehen.
      await memberPage.getByRole('tab', { name: 'Preferences' }).click();
      await memberPage.getByRole('button', { name: 'German' }).click();
      await expect(memberPage).toHaveURL(/\/settings$/);
      await expect(memberPage).not.toHaveURL(/\/en\//);
      await expect(memberPage.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    });
  });

  test.describe('Organization Settings', () => {
    test('member sees the organization tab', async ({ memberPage }) => {
      await openSettings(memberPage);
      await memberPage.getByRole('tab', { name: 'Organisation' }).click();
      await expect(memberPage.getByRole('textbox', { name: 'Name' })).toHaveValue(TEST_ORG.name);
    });

    // Der Admin aus der Ersteinrichtung ist Super-Admin. Frueher bekam er
    // statt "Organisation" nur "Plattform" und konnte den eigenen Verein
    // nicht bearbeiten. Das Speichern selbst scheiterte ausserdem fuer
    // jeden an der Beschreibung, die an der falschen Stelle mitging.
    test('the self-hosted admin can rename the organization', async ({ adminPage }) => {
      const dashboard = new DashboardPage(adminPage);
      await openSettings(adminPage);
      await expect(adminPage.getByRole('tab', { name: 'Plattform' })).toBeVisible();
      await adminPage.getByRole('tab', { name: 'Organisation' }).click();

      const name = adminPage.getByRole('textbox', { name: 'Name' });
      const description = adminPage.getByRole('textbox', { name: 'Beschreibung' });
      const save = adminPage.getByRole('button', { name: 'Änderungen speichern' });
      await expect(name).toHaveValue(TEST_ORG.name);

      await name.fill('E2E Verein umbenannt');
      await description.fill('Förderverein der Freiwilligen Feuerwehr');
      await save.click();
      await expect(dashboard.sidebar.getByRole('button', { name: /E2E Verein umbenannt/ })).toBeVisible();

      await adminPage.reload();
      await adminPage.getByRole('tab', { name: 'Organisation' }).click();
      await expect(name).toHaveValue('E2E Verein umbenannt');
      await expect(description).toHaveValue('Förderverein der Freiwilligen Feuerwehr');

      await name.fill(TEST_ORG.name);
      await description.fill('');
      await save.click();
      await expect(dashboard.sidebar.getByRole('button', { name: new RegExp(`${TEST_ORG.name}\\s+Administrator`) })).toBeVisible();
    });
  });
});
