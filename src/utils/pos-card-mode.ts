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
  /** Bargeldloser Modus der Organisation. */
  cashless?: boolean;
}): PosCardMode {
  if (!options.readerLinked || !options.sumupEnabled) return null;
  if (!options.isTest) return 'sumup';
  return options.cashless ? 'manual' : 'sumup_test';
}

/** Zahlarten im Kassieren-Blatt. */
export type PayMethod = 'cash' | 'card' | 'discount';

/**
 * Erste Zahlart beim Öffnen des Kassieren-Blatts: Bar, im bargeldlosen
 * Modus die Karte (sofern nutzbar), sonst Rabatt-Bons; `null` = keine
 * Zahlart verfügbar.
 */
export function initialPayMethod(options: {
  cashless: boolean;
  card: PosCardMode;
  hasVouchers: boolean;
}): PayMethod | null {
  if (!options.cashless) return 'cash';
  if (options.card && options.card !== 'sumup_test') return 'card';
  if (options.hasVouchers) return 'discount';
  return null;
}
