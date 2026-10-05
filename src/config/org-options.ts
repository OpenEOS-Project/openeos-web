/**
 * Auswahllisten für Organisations-Einstellungen.
 *
 * Währung, Sprache und Zeitzone haben eine feste Wertemenge — sie
 * gehören in ein Auswahlfeld, nicht in ein Freitextfeld. Die Listen
 * standen zuvor nur im Anlege-Assistenten; das Bearbeiten-Formular
 * erwartete dieselben Werte als Freitext. Eine gemeinsame Quelle, damit
 * beide nicht auseinanderlaufen.
 */

export interface Option {
  value: string;
  label: string;
}

export const CURRENCIES: readonly Option[] = [
  { value: 'EUR', label: '€ Euro' },
  { value: 'CHF', label: 'CHF Swiss Franc' },
  { value: 'USD', label: '$ US Dollar' },
] as const;

/**
 * Anzeigename einer Waehrung in der Sprache der Oberflaeche
 * ("CHF Schweizer Franken" / "CHF Swiss Franc"). Die festen Labels oben
 * bleiben nur als Rueckfall, falls Intl.DisplayNames fehlt.
 */
export function currencyLabel(option: Option, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(option.value);
    const symbol = option.label.split(' ')[0];
    return name ? `${symbol} ${name}` : option.label;
  } catch {
    return option.label;
  }
}

export const LOCALES: readonly Option[] = [
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'de-AT', label: 'Deutsch (Österreich)' },
  { value: 'de-CH', label: 'Deutsch (Schweiz)' },
  { value: 'en-US', label: 'English (US)' },
] as const;

export const TIMEZONES: readonly Option[] = [
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich' },
  { value: 'UTC', label: 'UTC' },
] as const;
