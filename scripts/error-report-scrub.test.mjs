/**
 * Tests fuer src/lib/error-report-scrub.mjs.
 *
 * Aufruf: node --test scripts/error-report-scrub.test.mjs (pnpm test:unit)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterHeaders,
  scrubBreadcrumb,
  scrubErrorEvent,
  scrubRequestInfo,
  stripQuery,
} from '../src/lib/error-report-scrub.mjs';

test('stripQuery entfernt Query und Fragment', () => {
  assert.equal(stripQuery('/de/login?token=abc#x'), '/de/login');
  assert.equal(stripQuery('https://example.org/a/b?x=1'), 'https://example.org/a/b');
  assert.equal(stripQuery('/a#frag'), '/a');
  assert.equal(stripQuery('/plain'), '/plain');
  assert.equal(stripQuery(undefined), undefined);
});

test('filterHeaders behaelt nur die Allowlist', () => {
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'accept-language': 'de-DE',
    referer: 'https://example.org/de/device?token=secret',
    cookie: 'session=abc',
    authorization: 'Bearer xyz',
    'x-device-token': 'dev-123',
    'set-cookie': ['a=1', 'b=2'],
    'x-forwarded-for': '203.0.113.7',
  };
  assert.deepEqual(filterHeaders(headers), {
    'user-agent': 'Mozilla/5.0',
    'accept-language': 'de-DE',
    referer: 'https://example.org/de/device',
  });
  assert.deepEqual(filterHeaders(undefined), {});
});

test('scrubRequestInfo bereinigt die onRequestError-Anfrage', () => {
  const info = scrubRequestInfo({
    path: '/de/admin?invite=abc',
    method: 'GET',
    headers: { cookie: 'session=abc', 'user-agent': 'UA' },
  });
  assert.deepEqual(info, { path: '/de/admin', method: 'GET', headers: { 'user-agent': 'UA' } });
});

test('scrubErrorEvent entfernt Cookies, Body, Query, IP und E-Mail', () => {
  const event = {
    request: {
      url: 'https://example.org/de/x?token=abc',
      query_string: 'token=abc',
      cookies: { session: 'abc' },
      data: { password: 'pw' },
      env: { REMOTE_ADDR: '203.0.113.7' },
      headers: { cookie: 'session=abc', authorization: 'Bearer x', 'user-agent': 'UA' },
    },
    user: { id: 'u1', email: 'a@example.org', ip_address: '203.0.113.7', username: 'a' },
    extra: { request: { path: '/x?y=1', method: 'POST', headers: { 'x-device-token': 't' } } },
    breadcrumbs: [{ category: 'fetch', data: { url: '/api/x?token=abc', method: 'GET' } }],
    contexts: { trace: { data: { 'url.full': 'https://example.org/x?token=abc', 'url.query': 'token=abc' } } },
    spans: [{ data: { 'http.target': '/x?token=abc', 'http.query': 'token=abc' } }],
  };

  const result = scrubErrorEvent(event);

  assert.equal(result, event);
  assert.deepEqual(result.request, {
    url: 'https://example.org/de/x',
    headers: { 'user-agent': 'UA' },
  });
  assert.deepEqual(result.user, { id: 'u1' });
  assert.deepEqual(result.extra.request, { path: '/x', method: 'POST', headers: {} });
  assert.deepEqual(result.breadcrumbs[0].data, { url: '/api/x', method: 'GET' });
  assert.deepEqual(result.contexts.trace.data, { 'url.full': 'https://example.org/x' });
  assert.deepEqual(result.spans[0].data, { 'http.target': '/x' });
});

test('scrubErrorEvent entfernt Nutzerangaben ohne ID vollstaendig', () => {
  const result = scrubErrorEvent({ user: { ip_address: '203.0.113.7' } });
  assert.equal('user' in result, false);
});

test('scrubBreadcrumb kuerzt Navigations-URLs', () => {
  const crumb = scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } });
  assert.deepEqual(crumb.data, { from: '/a', to: '/b' });
});
