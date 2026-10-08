import { expect, test } from '@playwright/test';

import { normalizePairingCode, PAIRING_CODE_LENGTH } from '@/utils/pairing-code';

test.describe('normalizePairingCode', () => {
  test('lässt einen Code ohne Trenner unverändert', () => {
    expect(normalizePairingCode('573080')).toBe('573080');
  });

  test('akzeptiert eingefügte Codes mit Leerzeichen oder Bindestrichen', () => {
    expect(normalizePairingCode('57 30 80')).toBe('573080');
    expect(normalizePairingCode(' 573 080 ')).toBe('573080');
    expect(normalizePairingCode('573-080')).toBe('573080');
    expect(normalizePairingCode('57 30 80')).toBe('573080');
  });

  test('schneidet nach sechs Ziffern ab und verwirft Buchstaben', () => {
    expect(normalizePairingCode('5730801')).toBe('573080');
    expect(normalizePairingCode('Code: 573080')).toBe('573080');
    expect(normalizePairingCode('5a7b3')).toBe('573');
    expect(PAIRING_CODE_LENGTH).toBe(6);
  });

  test('kommt mit leeren Werten zurecht', () => {
    expect(normalizePairingCode('')).toBe('');
    expect(normalizePairingCode(null)).toBe('');
    expect(normalizePairingCode(undefined)).toBe('');
  });
});
