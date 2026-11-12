import { expect, test } from '@playwright/test';

import {
  isCompletePairingCode,
  normalizePairingCode,
  PAIRING_CODE_LENGTH,
} from '@/utils/pairing-code';

test.describe('normalizePairingCode', () => {
  test('lässt einen Code ohne Trenner unverändert', () => {
    expect(normalizePairingCode('57308012')).toBe('57308012');
  });

  test('akzeptiert eingefügte Codes mit Leerzeichen oder Bindestrichen', () => {
    expect(normalizePairingCode('5730 8012')).toBe('57308012');
    expect(normalizePairingCode(' 573 080 12 ')).toBe('57308012');
    expect(normalizePairingCode('5730-8012')).toBe('57308012');
  });

  test('schneidet nach acht Ziffern ab und verwirft Buchstaben', () => {
    expect(normalizePairingCode('573080123')).toBe('57308012');
    expect(normalizePairingCode('Code: 57308012')).toBe('57308012');
    expect(normalizePairingCode('5a7b3')).toBe('573');
    expect(PAIRING_CODE_LENGTH).toBe(8);
  });

  test('kommt mit leeren Werten zurecht', () => {
    expect(normalizePairingCode('')).toBe('');
    expect(normalizePairingCode(null)).toBe('');
    expect(normalizePairingCode(undefined)).toBe('');
  });
});

test.describe('isCompletePairingCode', () => {
  test('erkennt achtstellige Codes und sechsstellige älterer Geräte', () => {
    expect(isCompletePairingCode('57308012')).toBe(true);
    expect(isCompletePairingCode('573080')).toBe(true);
    expect(isCompletePairingCode('5730801')).toBe(false);
    expect(isCompletePairingCode('')).toBe(false);
  });
});
