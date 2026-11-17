import { apiClient } from '@/lib/api-client';
import { expect, test } from '@playwright/test';

/*
 * Uploads und Downloads außerhalb von request(): ohne Token im Speicher
 * (nach dem Neuladen) kein „Bearer null“, Cookies immer mitsenden, bei 401
 * einmal erneuern und wiederholen.
 */

type Call = { url: string; init: RequestInit };

function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift() ?? { status: 200 };
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

test.afterEach(() => apiClient.clearAccessToken());

test('without a token in memory no Authorization header is sent, cookies are', async () => {
  apiClient.clearAccessToken();
  const { calls, restore } = mockFetch([{ status: 200 }]);
  try {
    await apiClient.authorizedFetch('/users/me/avatar', { method: 'POST', body: new FormData() });
  } finally {
    restore();
  }
  expect(calls).toHaveLength(1);
  expect(new Headers(calls[0].init.headers).has('Authorization')).toBe(false);
  expect(calls[0].init.credentials).toBe('include');
  expect(calls[0].init.method).toBe('POST');
});

test('with a token the Bearer header is sent', async () => {
  apiClient.setAccessToken('abc');
  const { calls, restore } = mockFetch([{ status: 200 }]);
  try {
    await apiClient.authorizedFetch('/x');
  } finally {
    restore();
  }
  expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer abc');
});

test('a 401 refreshes the token once and retries with it', async () => {
  apiClient.clearAccessToken();
  const { calls, restore } = mockFetch([
    { status: 401 },
    { status: 200, body: { data: { accessToken: 'fresh' } } },
    { status: 200 },
  ]);
  let status = 0;
  try {
    status = (await apiClient.authorizedFetch('/x', { method: 'POST' })).status;
  } finally {
    restore();
  }
  expect(status).toBe(200);
  expect(calls.map((c) => c.url.replace(/^.*?(\/auth\/refresh|\/x)$/, '$1'))).toEqual(['/x', '/auth/refresh', '/x']);
  expect(new Headers(calls[2].init.headers).get('Authorization')).toBe('Bearer fresh');
});

test('a second 401 is returned instead of retrying again', async () => {
  const { calls, restore } = mockFetch([
    { status: 401 },
    { status: 200, body: { data: { accessToken: 'fresh' } } },
    { status: 401 },
  ]);
  let status = 0;
  try {
    status = (await apiClient.authorizedFetch('/x')).status;
  } finally {
    restore();
  }
  expect(status).toBe(401);
  expect(calls).toHaveLength(3);
});
