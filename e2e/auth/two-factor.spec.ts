import { test, expect, type Request } from '@playwright/test';

import { LoginPage } from '../pages/login.page';

/*
 * Zweiter Anmeldeschritt, API-Antworten nachgestellt: Was schickt die
 * Maske? Ob ein Gerät vertraut ist, entscheidet die API allein an ihrem
 * httpOnly-Cookie — die Maske schickt keinen eigenen Gerätewert mehr, beim
 * Vertrauen nur Name, Browser und System für die Geräteliste.
 */
test.describe('Two-factor sign-in', () => {
  test('sends no device value and names the trusted device', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    const body = (request: Request) => request.postDataJSON() as Record<string, unknown>;

    await page.route('**/api/auth/login', async (route) => {
      sent.push(body(route.request()));
      await route.fulfill({
        json: { data: { twoFactorRequired: true, twoFactorToken: 'pending-token', twoFactorMethod: 'totp' } },
      });
    });
    await page.route('**/api/auth/2fa/verify', async (route) => {
      sent.push(body(route.request()));
      await route.fulfill({ status: 401, json: { error: { code: 'INVALID_2FA_CODE', message: 'x' } } });
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // Gehostete Installationen beginnen beim Anmeldelink.
    await loginPage.emailInput.waitFor();
    const usePassword = page.getByRole('button', { name: 'Doch mit Passwort anmelden' });
    if (await usePassword.isVisible().catch(() => false)) await usePassword.click();
    await loginPage.login('kim@example.org', 'irgendein-Passwort-1');
    await expect(page).toHaveURL(/\/2fa-verify\?/);

    await page.locator('input[autocomplete="one-time-code"]').fill('123456');
    await page.getByText('Diesem Gerät für 30 Tage vertrauen').click();
    await page.getByRole('button', { name: 'Verifizieren' }).click();
    await expect.poll(() => sent.length).toBe(2);

    const [login, verify] = sent;
    expect(Object.keys(login).sort()).toEqual(['email', 'password']);
    expect(verify).toMatchObject({ code: '123456', trustDevice: true });
    expect(typeof verify.deviceName).toBe('string');
    expect(typeof verify.browser).toBe('string');
    expect(typeof verify.os).toBe('string');
    expect(verify).not.toHaveProperty('deviceFingerprint');
    expect(verify).not.toHaveProperty('deviceInfo');
  });
});
