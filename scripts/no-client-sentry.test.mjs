/*
 * Im Browser laeuft bewusst kein Sentry: Die Datenschutzerklaerung sagt zu,
 * dass vom Browser nichts an Sentry geht. Fehlerberichte entstehen nur auf
 * dem Server (sentry.server.config.ts, sentry.edge.config.ts,
 * onRequestError in src/instrumentation.ts).
 *
 * Aufruf: node --test scripts/no-client-sentry.test.mjs (pnpm test:unit)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('no client-side Sentry configuration exists', () => {
  for (const file of [
    'sentry.client.config.ts',
    'sentry.client.config.js',
    'instrumentation-client.ts',
    'instrumentation-client.js',
    'src/instrumentation-client.ts',
    'src/instrumentation-client.js',
  ]) {
    assert.equal(existsSync(path.join(ROOT, file)), false, `${file} must not exist`);
  }
});

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.(tsx?|mjs|jsx?)$/.test(name)) yield full;
  }
}

test('no client component imports @sentry/nextjs', () => {
  const offenders = [];
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8');
    if (/^\s*['"]use client['"]/.test(text) && /@sentry\//.test(text)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});
