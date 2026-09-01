/**
 * Umsatzsteuersätze für die Auswahl im Produktformular.
 *
 * Spiegelt `tax-rates.ts` in openeos-api. Maßgeblich ist der Server: er
 * weist einen Satz zurück, den die Organisation nicht führen darf. Hier
 * steht die Liste nur, damit das Formular gar nicht erst etwas anbietet,
 * was hinterher abgelehnt würde. Ändert sich die Regel dort, muss sie
 * hier mitgehen.
 *
 * Bewusst nur Deutschland: ein Satz, den niemand geprüft hat, ist
 * schlimmer als kein Satz — er sieht richtig aus und landet auf einem Beleg.
 */
export interface TaxRateOption {
  rate: number;
  labelKey: 'standard' | 'reduced' | 'zero';
}

const BY_COUNTRY: Record<string, TaxRateOption[]> = {
  DE: [
    { rate: 19, labelKey: 'standard' },
    { rate: 7, labelKey: 'reduced' },
    { rate: 0, labelKey: 'zero' },
  ],
};

const EXEMPT: TaxRateOption[] = [{ rate: 0, labelKey: 'zero' }];

/**
 * Welche Sätze darf diese Organisation wählen?
 *
 * Ohne ausdrücklich gesetzte Steuerpflicht bleibt es bei 0 — die
 * Organisationen hier sind überwiegend Vereine, und ein voreingestellter
 * Steuersatz wäre für sie schlicht falsch.
 */
export function taxRatesFor(
  country: string | undefined,
  vatExempt: boolean | undefined,
): TaxRateOption[] {
  if (vatExempt !== false) return EXEMPT;
  return BY_COUNTRY[(country || '').toUpperCase()] ?? EXEMPT;
}
