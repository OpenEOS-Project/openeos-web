/**
 * Kartenzahlung an der Kasse:
 * - `sumup`: Lesegerät verknüpft, SumUp eingeschaltet — Zahlung am Terminal.
 * - `sumup_test`: dasselbe, aber die Veranstaltung ist im Testmodus. Die
 *   Kasse löst dann keine echte Kartenzahlung aus (die API lehnt sie mit
 *   `SUMUP_DISABLED_IN_TEST_MODE` ab); die Zahlart erscheint deaktiviert.
 * - `manual`: Buchung ohne Gerät (externes Terminal). Auch im Testmodus
 *   bei bargeldlosem Betrieb: sonst bliebe dort keine Zahlart, mit der sich
 *   der Kassenablauf durchspielen lässt.
 * - `null`: keine Karte.
 */
export type PosCardMode = 'sumup' | 'sumup_test' | 'manual' | null;

export function resolvePosCardMode(options: {
  readerLinked: boolean;
  sumupEnabled: boolean;
  isTest: boolean;
  /** Kein Bargeld in der Organisation (Betriebsart). */
  cashless?: boolean;
}): PosCardMode {
  if (!options.readerLinked || !options.sumupEnabled) return null;
  if (!options.isTest) return 'sumup';
  return options.cashless ? 'manual' : 'sumup_test';
}

/**
 * Zahlarten im Kassieren-Blatt. `test_cash`/`test_card` („Bar (Test)“,
 * „Karte (Test)“): simulierte Testzahlungen für Testbestellungen — kein
 * Geld, keine Kassenlade, kein Kassenbuch, keine TSE (siehe `testCheckout`).
 */
export type PayMethod = 'cash' | 'card' | 'discount' | 'test_cash' | 'test_card';

/** Simulierte Testzahlarten (nur Testbestellungen, nie „Nur Bons“). */
export type TestPayMethod = 'test_cash' | 'test_card';

export function isTestPayMethod(method: string | null | undefined): method is TestPayMethod {
  return method === 'test_cash' || method === 'test_card';
}

/**
 * Kassiert die Kasse gerade Testbestellungen? Dann bietet das
 * Kassieren-Blatt „Bar (Test)“ und „Karte (Test)“ statt echter Zahlarten an
 * — in jeder Betriebsart außer „Nur Bons“, unabhängig von Land, TSE und
 * SumUp. Maßgeblich ist das Kennzeichen der Bestellungen (`isTest`); wo es
 * fehlt (Warenkorb, ältere Antworten), die Phase der Veranstaltung
 * (`fallback`: Testmodus oder „Geplant“). Gemischt (echt und Test): echte
 * Zahlarten — die API nimmt Testzahlungen nur für Testbestellungen an.
 */
export function testCheckout(
  orders: readonly { isTest?: boolean | null }[],
  fallback: boolean,
): boolean {
  const flags = orders.map((o) => o.isTest).filter((v): v is boolean => typeof v === 'boolean');
  if (flags.length === 0) return fallback;
  return flags.every(Boolean);
}

/**
 * Erste Zahlart beim Öffnen des Kassieren-Blatts: im Testbetrieb „Bar
 * (Test)“, sonst Bar, ohne Bargeld die Karte (sofern nutzbar), sonst
 * Rabatt-Bons; `null` = keine Zahlart verfügbar.
 */
export function initialPayMethod(options: {
  cashless: boolean;
  card: PosCardMode;
  hasVouchers: boolean;
  /** Testbestellungen: simulierte Testzahlarten. */
  testMode?: boolean;
}): PayMethod | null {
  if (options.testMode) return 'test_cash';
  if (!options.cashless) return 'cash';
  if (options.card && options.card !== 'sumup_test') return 'card';
  if (options.hasVouchers) return 'discount';
  return null;
}
