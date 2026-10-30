import {
  API_TOKEN_EXPIRY_PRESETS,
  apiDocsUrl,
  apiTokenLimitReached,
  apiTokenPreview,
  apiTokenStatus,
  countActiveApiTokens,
  expiresAtFromDateInput,
  expiryDateFromPreset,
  expiryPresetForDate,
  isExpiryInPast,
  MAX_ACTIVE_API_TOKENS,
  sortApiTokens,
  toDateInputValue,
} from '@/lib/api-tokens';
import { expect, test } from '@playwright/test';

import { TIME_ZONES, inTimeZone } from './helpers';

/*
 * Zugänge (API-Tokens): Status aus Ablauf und Widerruf, Sortierung der
 * Liste, Höchstzahl und die Vorgaben für das Ablaufdatum.
 */

const NOW = new Date('2026-10-30T12:00:00.000Z');

function token(id: string, expiresAt: string | null = null, revokedAt: string | null = null) {
  return { id, expiresAt, revokedAt };
}

test.describe('api token status', () => {
  test('active without expiry and revocation', () => {
    expect(apiTokenStatus(token('a'), NOW)).toBe('active');
  });

  test('active until the expiry has passed', () => {
    expect(apiTokenStatus(token('a', '2026-10-30T12:00:00.001Z'), NOW)).toBe('active');
    expect(apiTokenStatus(token('a', '2026-10-30T12:00:00.000Z'), NOW)).toBe('expired');
    expect(apiTokenStatus(token('a', '2026-01-01T00:00:00.000Z'), NOW)).toBe('expired');
  });

  test('revoked wins over expired', () => {
    expect(apiTokenStatus(token('a', '2026-01-01T00:00:00.000Z', '2025-12-01T00:00:00.000Z'), NOW)).toBe('revoked');
    expect(apiTokenStatus(token('a', null, '2026-10-29T00:00:00.000Z'), NOW)).toBe('revoked');
  });
});

test.describe('api token list', () => {
  const list = [
    token('newest-revoked', null, '2026-10-29T00:00:00.000Z'),
    token('active-1'),
    token('expired', '2026-05-01T00:00:00.000Z'),
    token('active-2', '2027-01-01T00:00:00.000Z'),
  ];

  test('active first, inactive at the bottom, order within a group unchanged', () => {
    expect(sortApiTokens(list, NOW).map((t) => t.id)).toEqual(['active-1', 'active-2', 'newest-revoked', 'expired']);
  });

  test('counts only active tokens towards the limit', () => {
    expect(countActiveApiTokens(list, NOW)).toBe(2);
    expect(apiTokenLimitReached(list, NOW)).toBe(false);
    const full = Array.from({ length: MAX_ACTIVE_API_TOKENS }, (_, i) => token(`t${i}`));
    expect(apiTokenLimitReached(full, NOW)).toBe(true);
    expect(apiTokenLimitReached([...full.slice(1), token('x', '2026-01-01T00:00:00.000Z')], NOW)).toBe(false);
  });

  test('shows only the prefix with an ellipsis', () => {
    expect(apiTokenPreview('oeos_JGScPub')).toBe('oeos_JGScPub…');
  });

  test('docs link per language', () => {
    expect(apiDocsUrl('de')).toBe('https://docs.openeos.de/api');
    expect(apiDocsUrl('en')).toBe('https://docs.openeos.de/en/api');
  });
});

test.describe('api token expiry presets', () => {
  test('presets are never, 30, 90 and 365 days', () => {
    expect([...API_TOKEN_EXPIRY_PRESETS]).toEqual(['never', 30, 90, 365]);
  });

  for (const zone of TIME_ZONES) {
    test(`presets yield the calendar day n days ahead in ${zone}`, () => {
      inTimeZone(zone, () => {
        const now = new Date(2026, 0, 31, 23, 30); // local time, month boundary
        expect(expiryDateFromPreset('never', now)).toBe('');
        expect(expiryDateFromPreset(30, now)).toBe('2026-03-02');
        expect(expiryDateFromPreset(90, now)).toBe('2026-05-01');
        expect(expiryDateFromPreset(365, now)).toBe('2027-01-31');
        expect(toDateInputValue(now)).toBe('2026-01-31');
      });
    });

    test(`preset is recognised from the field value in ${zone}`, () => {
      inTimeZone(zone, () => {
        const now = new Date(2026, 9, 30, 9, 0);
        expect(expiryPresetForDate('', now)).toBe('never');
        expect(expiryPresetForDate(expiryDateFromPreset(90, now), now)).toBe(90);
        expect(expiryPresetForDate('2026-12-24', now)).toBeNull();
      });
    });

    test(`the chosen day counts until its end in ${zone}`, () => {
      inTimeZone(zone, () => {
        const iso = expiresAtFromDateInput('2026-11-15');
        expect(iso).not.toBeNull();
        const end = new Date(iso as string);
        expect(end.getFullYear()).toBe(2026);
        expect(end.getMonth()).toBe(10);
        expect(end.getDate()).toBe(15);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
      });
    });
  }

  test('empty or malformed input means no expiry', () => {
    expect(expiresAtFromDateInput('')).toBeNull();
    expect(expiresAtFromDateInput('   ')).toBeNull();
    expect(expiresAtFromDateInput('15.11.2026')).toBeNull();
    expect(isExpiryInPast('', NOW)).toBe(false);
  });

  test('today is still allowed, yesterday is in the past', () => {
    inTimeZone('Europe/Berlin', () => {
      const now = new Date(2026, 9, 30, 12, 0);
      expect(isExpiryInPast('2026-10-30', now)).toBe(false);
      expect(isExpiryInPast('2026-10-29', now)).toBe(true);
      expect(isExpiryInPast('2026-10-31', now)).toBe(false);
    });
  });
});
