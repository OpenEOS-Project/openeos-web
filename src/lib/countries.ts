/**
 * Länder nach ISO 3166-1 alpha-2 (offiziell vergebene Codes, wie die API in
 * src/common/constants/countries.ts). Namen liefert der Browser über
 * `Intl.DisplayNames` in der Sprache der Oberfläche.
 *
 * Das Land einer Organisation steuert die wählbaren Betriebsarten (siehe
 * operating-mode.ts) und die wählbaren Steuersätze.
 */
// prettier-ignore
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/** Oben in der Auswahl: unser Schwerpunkt (DACH). */
export const PRIORITY_COUNTRIES: CountryCode[] = ['DE', 'AT', 'CH'];

const KNOWN = new Set<string>(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && KNOWN.has(value);
}

/** Großgeschrieben und bekannt, sonst null. */
export function normalizeCountry(value: unknown): CountryCode | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return KNOWN.has(code) ? (code as CountryCode) : null;
}

/** Name des Landes in der Sprache der Oberfläche; ohne Intl der Code. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface CountryOption {
  code: CountryCode;
  name: string;
}

/**
 * Auswahl für das Länderfeld: DE, AT, CH oben (in dieser Reihenfolge),
 * darunter alle übrigen alphabetisch nach Namen in der Oberflächensprache.
 */
export function countryOptions(locale: string): { top: CountryOption[]; rest: CountryOption[] } {
  const top = PRIORITY_COUNTRIES.map((code) => ({ code, name: countryName(code, locale) }));
  const collator = new Intl.Collator(locale);
  const rest = COUNTRY_CODES.filter((code) => !PRIORITY_COUNTRIES.includes(code))
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return { top, rest };
}
