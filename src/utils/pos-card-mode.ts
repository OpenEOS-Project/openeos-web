/**
 * Kartenzahlung an der Kasse:
 * - `sumup`: Lesegerät verknüpft, SumUp eingeschaltet — Zahlung am Terminal.
 * - `sumup_test`: dasselbe, aber die Veranstaltung ist im Testmodus. Die
 *   Kasse löst dann keine echte Kartenzahlung aus (die API lehnt sie mit
 *   `SUMUP_DISABLED_IN_TEST_MODE` ab); die Zahlart erscheint deaktiviert.
 * - `manual`: Buchung ohne Gerät (externes Terminal).
 * - `null`: keine Karte.
 */
export type PosCardMode = 'sumup' | 'sumup_test' | 'manual' | null;

export function resolvePosCardMode(options: {
  readerLinked: boolean;
  sumupEnabled: boolean;
  isTest: boolean;
}): PosCardMode {
  if (!options.readerLinked || !options.sumupEnabled) return null;
  return options.isTest ? 'sumup_test' : 'sumup';
}
