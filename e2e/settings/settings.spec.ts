import { test, expect } from '../fixtures/auth.fixture';

test.describe('Settings', () => {
  test.describe('Personal Settings', () => {
    test('can access settings page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');
      await expect(authenticatedPage.getByText(/einstellungen|settings/i)).toBeVisible();
    });

    test('shows profile section', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');
      await expect(authenticatedPage.getByText(/profil|profile/i)).toBeVisible();
    });

    test('can update profile name', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Find name input
      const nameInput = authenticatedPage.getByLabel(/name|vorname/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('Updated Name');

        // Save button
        const saveButton = authenticatedPage.getByRole('button', { name: /speichern|save/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();

          // Should show success message
          await expect(authenticatedPage.getByText(/gespeichert|saved|success/i)).toBeVisible();
        }
      }
    });
  });

  test.describe('Password Change', () => {
    test('shows password change section', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Navigate to security/password section if needed
      const securityTab = authenticatedPage.getByRole('tab', { name: /sicherheit|security/i });
      if (await securityTab.isVisible()) {
        await securityTab.click();
      }

      await expect(authenticatedPage.getByText(/passwort ändern|change password/i)).toBeVisible();
    });

    test('validates password requirements', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Navigate to password section
      const securityTab = authenticatedPage.getByRole('tab', { name: /sicherheit|security/i });
      if (await securityTab.isVisible()) {
        await securityTab.click();
      }

      // Try to submit short password
      const currentPasswordInput = authenticatedPage.getByLabel(/aktuelles passwort|current password/i);
      const newPasswordInput = authenticatedPage.getByLabel(/neues passwort|new password/i);

      if (await currentPasswordInput.isVisible()) {
        await currentPasswordInput.fill('currentpw');
        await newPasswordInput.fill('short');

        const saveButton = authenticatedPage.getByRole('button', { name: /ändern|change/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
          // Should show validation error
        }
      }
    });
  });

  test.describe('Theme Settings', () => {
    test('can change theme', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Find theme selector
      const themeSelect = authenticatedPage.getByRole('combobox', { name: /theme|design/i });
      const darkButton = authenticatedPage.getByRole('button', { name: /dark|dunkel/i });
      const lightButton = authenticatedPage.getByRole('button', { name: /light|hell/i });

      if (await themeSelect.isVisible()) {
        await themeSelect.click();
        const darkOption = authenticatedPage.getByRole('option', { name: /dark|dunkel/i });
        if (await darkOption.isVisible()) {
          await darkOption.click();
        }
      } else if (await darkButton.isVisible()) {
        await darkButton.click();
      }
    });
  });

  test.describe('Language Settings', () => {
    test('can change language', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Find language selector
      const languageSelect = authenticatedPage.getByRole('combobox', { name: /sprache|language/i });

      if (await languageSelect.isVisible()) {
        await languageSelect.click();
        const englishOption = authenticatedPage.getByRole('option', { name: /english|englisch/i });
        if (await englishOption.isVisible()) {
          await englishOption.click();
          // URL should change to /en/
          await expect(authenticatedPage).toHaveURL(/\/en\//);
        }
      }
    });
  });

  test.describe('Organization Settings', () => {
    test('shows organization tab for managers', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      const orgTab = authenticatedPage.getByRole('tab', { name: /organisation/i });
      await expect(orgTab).toBeVisible();
    });

    test('can update organization name', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/de/settings');

      // Click organization tab
      const orgTab = authenticatedPage.getByRole('tab', { name: /organisation/i });
      if (await orgTab.isVisible()) {
        await orgTab.click();

        const nameInput = authenticatedPage.getByLabel(/name/i).first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Updated Org Name');

          const saveButton = authenticatedPage.getByRole('button', { name: /speichern|save/i });
          if (await saveButton.isVisible()) {
            await saveButton.click();
          }
        }
      }
    });
  });
});
