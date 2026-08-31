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
  { value: 'CHF', label: 'CHF Schweizer Franken' },
  { value: 'USD', label: '$ US Dollar' },
] as const;

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
