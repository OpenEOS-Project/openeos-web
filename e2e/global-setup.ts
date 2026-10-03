import { request, type FullConfig } from '@playwright/test';

import { TOUR_VERSION } from '../src/components/onboarding/tour-steps';
import { apiLogin, apiPost, ensureOk, newApiContext } from './fixtures/api';
import { API_URL, TEST_ADMIN, TEST_ORG, TEST_USER } from './fixtures/test-data';

/**
 * Bringt die API in den Zustand, den die Tests voraussetzen.
 *
 * Laeuft gegen eine eigenstaendige Installation (DEPLOYMENT_MODE=selfhosted):
 * die Ersteinrichtung legt Administrator und Organisation an, danach kommt
 * ein gewoehnliches Mitglied dazu. Jeder Schritt prueft zuerst, ob er schon
 * erledigt ist — lokal laeuft die Suite so beliebig oft gegen dieselbe
 * Datenbank, ohne sie vorher leeren zu muessen.
 *
 * Bewusst ueber die API und nicht per SQL-Seed: so gilt dieselbe
 * Validierung wie im echten Betrieb, und die Suite merkt es, wenn sich die
 * Ersteinrichtung aendert.
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const api = await newApiContext();

  try {
    const health = await api.get('health');
    if (!health.ok()) {
      throw new Error(`API unter ${API_URL} antwortet mit ${health.status()}`);
    }

    const status = (await (await api.get('setup/status')).json()).data;
    if (status.deployment?.mode !== 'selfhosted') {
      // Die Suite prueft das Verhalten der eigenstaendigen Installation
      // (keine Registrierung, keine Abrechnung). Gegen eine SaaS-API
      // schluegen Tests fehl, deren Ursache nicht im Test laege.
      throw new Error(
        `API laeuft im Modus "${status.deployment?.mode}", erwartet ist DEPLOYMENT_MODE=selfhosted`,
      );
    }

    if (status.required) {
      await apiPost(api, 'setup', {}, {
        mode: 'single',
        email: TEST_ADMIN.email,
        password: TEST_ADMIN.password,
        firstName: TEST_ADMIN.firstName,
        lastName: TEST_ADMIN.lastName,
        organizationName: TEST_ORG.name,
      });
    }

    const admin = await apiLogin(api, TEST_ADMIN.email, TEST_ADMIN.password);
    const orgId = admin.organizationId;

    const members = (
      await (await api.get(`organizations/${orgId}/members`, { headers: admin.headers })).json()
    ).data as Array<{ user?: { email: string } }>;
    if (!members.some((m) => m.user?.email === TEST_USER.email)) {
      await apiPost(api, `organizations/${orgId}/members`, admin.headers, {
        email: TEST_USER.email,
        password: TEST_USER.password,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        role: 'member',
      });
    }

    // Die Willkommens-Tour legt sich beim ersten Dashboard-Besuch ueber
    // die ganze Seite und faengt jeden Klick ab. Sie ist ein eigenes
    // Thema; fuer alle uebrigen Tests gilt sie als gesehen.
    const member = await apiLogin(api, TEST_USER.email, TEST_USER.password);
    for (const { headers } of [admin, member]) {
      const res = await api.patch('users/me/preferences', {
        headers,
        data: { onboarding: { tourVersion: TOUR_VERSION } },
      });
      await ensureOk(res, 'Einstellungen setzen');
    }
  } finally {
    await api.dispose();
  }

  // Die Oberflaeche muss antworten, bevor der erste Test startet — sonst
  // meldet jeder einzelne Test denselben Verbindungsfehler.
  const web = await request.newContext({ baseURL });
  try {
    const res = await web.get('/login');
    if (!res.ok()) throw new Error(`Oberflaeche unter ${baseURL} antwortet mit ${res.status()}`);
  } finally {
    await web.dispose();
  }
}

export default globalSetup;
