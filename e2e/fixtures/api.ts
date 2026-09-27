import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { API_URL } from './test-data';

/**
 * Direkter Zugang zur API fuer Testvorbereitung, die nicht selbst Gegenstand
 * des Tests ist (Konten, Stammdaten). Was ein Test prueft, laeuft dagegen
 * ueber die Oberflaeche.
 */
export async function newApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: `${API_URL}/api/` });
}

export async function ensureOk(res: APIResponse, what: string) {
  if (!res.ok()) {
    throw new Error(`${what} fehlgeschlagen: ${res.status()} ${await res.text()}`);
  }
}

export async function apiLogin(api: APIRequestContext, email: string, password: string) {
  const res = await api.post('auth/login', { data: { email, password } });
  await ensureOk(res, `Anmeldung als ${email}`);
  const data = (await res.json()).data as {
    accessToken: string;
    user: { userOrganizations: Array<{ organizationId: string }> };
  };
  return {
    headers: { authorization: `Bearer ${data.accessToken}` },
    organizationId: data.user.userOrganizations[0]?.organizationId,
  };
}

/** POST und die `data` der Antwort, oder ein Fehler mit dem Text der API. */
export async function apiPost<T = { id: string }>(
  api: APIRequestContext,
  path: string,
  headers: Record<string, string>,
  data?: unknown,
): Promise<T> {
  const res = await api.post(path, { headers, data });
  await ensureOk(res, `POST ${path}`);
  return (await res.json()).data as T;
}
