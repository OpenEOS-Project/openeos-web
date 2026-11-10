import { expect, test } from '@playwright/test';

import { doneSheetAutoCloses, looksLikeEmail, receiptAvailable } from '@/lib/receipt';

test.describe('Beleg ausgeben', () => {
  test('prüft E-Mail-Adressen grob vor dem Senden', () => {
    expect(looksLikeEmail('gast@example.org')).toBe(true);
    expect(looksLikeEmail('  gast@example.org ')).toBe(true);
    expect(looksLikeEmail('gast@example')).toBe(false);
    expect(looksLikeEmail('kein-at')).toBe(false);
    expect(looksLikeEmail(`${'a'.repeat(250)}@example.org`)).toBe(false);
  });

  test('ohne Zahlung gibt es keinen Kassenbeleg', () => {
    expect(receiptAvailable('cash', ['o-1'])).toBe(true);
    expect(receiptAvailable('free', ['o-1'])).toBe(false);
    expect(receiptAvailable('card', [])).toBe(false);
  });

  test('das Abschlussblatt bleibt stehen, solange der Beleg nur angeboten ist', () => {
    const base = { hasChange: false, interacted: false, autoPrinted: false, receiptAvailable: true };
    // QR-Code steht da, kein Papierbon: nicht von selbst schließen.
    expect(doneSheetAutoCloses(base)).toBe(false);
    // Bon schon automatisch gedruckt: wie bisher nach 5 s schließen.
    expect(doneSheetAutoCloses({ ...base, autoPrinted: true })).toBe(true);
    // Kein Beleg möglich („ohne Zahlung“): schließen.
    expect(doneSheetAutoCloses({ ...base, receiptAvailable: false })).toBe(true);
    // Rückgeld oder Eingabe: nie.
    expect(doneSheetAutoCloses({ ...base, autoPrinted: true, hasChange: true })).toBe(false);
    expect(doneSheetAutoCloses({ ...base, autoPrinted: true, interacted: true })).toBe(false);
  });
});
