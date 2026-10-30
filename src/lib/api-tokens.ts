import type { ApiToken, ApiTokenStatus } from '@/types/api-token';

/**
 * Zugänge (API-Tokens): reine Hilfen für Liste und Dialog
 * (settings/components/organization-access-section.tsx).
 */

/** Höchstzahl aktiver Zugänge je Organisation — wie `MAX_ACTIVE_TOKENS_PER_ORGANIZATION` in der API. */
export const MAX_ACTIVE_API_TOKENS = 20;

/**
 * Widerrufen schlägt Ablauf: ein widerrufener Zugang bleibt widerrufen,
 * auch wenn sein Ablaufdatum inzwischen vorbei ist. Ein Ablauf genau
 * jetzt zählt schon als abgelaufen — die API lehnt ihn genauso ab.
 */
export function apiTokenStatus(token: Pick<ApiToken, 'expiresAt' | 'revokedAt'>, now: Date = new Date()): ApiTokenStatus {
  if (token.revokedAt) return 'revoked';
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export function isApiTokenActive(token: Pick<ApiToken, 'expiresAt' | 'revokedAt'>, now: Date = new Date()): boolean {
  return apiTokenStatus(token, now) === 'active';
}

/**
 * Aktive Zugänge zuerst, dann die abgelaufenen und widerrufenen — jeweils
 * in der Reihenfolge der API (neueste zuerst). Stabil: innerhalb einer
 * Gruppe ändert sich nichts.
 */
export function sortApiTokens<T extends Pick<ApiToken, 'expiresAt' | 'revokedAt'>>(tokens: readonly T[], now: Date = new Date()): T[] {
  const active: T[] = [];
  const inactive: T[] = [];
  for (const token of tokens) (isApiTokenActive(token, now) ? active : inactive).push(token);
  return [...active, ...inactive];
}

export function countActiveApiTokens(tokens: readonly Pick<ApiToken, 'expiresAt' | 'revokedAt'>[], now: Date = new Date()): number {
  return tokens.filter((token) => isApiTokenActive(token, now)).length;
}

/** `true`, sobald kein weiterer Zugang mehr angelegt werden kann. */
export function apiTokenLimitReached(tokens: readonly Pick<ApiToken, 'expiresAt' | 'revokedAt'>[], now: Date = new Date()): boolean {
  return countActiveApiTokens(tokens, now) >= MAX_ACTIVE_API_TOKENS;
}

/** Vorgaben für das Ablaufdatum: Tage ab heute oder „nie“. */
export const API_TOKEN_EXPIRY_PRESETS = ['never', 30, 90, 365] as const;
export type ApiTokenExpiryPreset = (typeof API_TOKEN_EXPIRY_PRESETS)[number];

/** Kalendertag (lokal) als `YYYY-MM-DD`, wie ihn `<input type="date">` erwartet. */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Wert für das Datumsfeld zu einer Vorgabe: „nie“ leert das Feld, `n` Tage
 * ergeben den Kalendertag n Tage nach `now` (lokal, Monatswechsel inklusive).
 */
export function expiryDateFromPreset(preset: ApiTokenExpiryPreset, now: Date = new Date()): string {
  if (preset === 'never') return '';
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + preset);
  return toDateInputValue(target);
}

/** Welche Vorgabe zum Feldwert passt — `null`, wenn ein eigenes Datum steht. */
export function expiryPresetForDate(value: string, now: Date = new Date()): ApiTokenExpiryPreset | null {
  for (const preset of API_TOKEN_EXPIRY_PRESETS) {
    if (expiryDateFromPreset(preset, now) === value) return preset;
  }
  return null;
}

/**
 * Ablaufzeitpunkt für die API aus dem Feldwert: Ende des gewählten Tages in
 * der Zeitzone des Browsers — wer „30. Juni“ wählt, meint den ganzen Tag.
 * Leer oder unlesbar → `null` (läuft nie ab).
 */
export function expiresAtFromDateInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const end = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
  if (Number.isNaN(end.getTime())) return null;
  return end.toISOString();
}

/** Ein Ablaufdatum vor heute lehnt die API ab — das Feld meldet es vorher. */
export function isExpiryInPast(value: string, now: Date = new Date()): boolean {
  const iso = expiresAtFromDateInput(value);
  if (!iso) return false;
  return new Date(iso).getTime() <= now.getTime();
}

/** Öffentliche API-Referenz (openeos-docs), je Sprache. */
export function apiDocsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en/api' : 'https://docs.openeos.de/api';
}

/** Anleitung „KI-Agenten verbinden“ (MCP) in openeos-docs, je Sprache. */
export function agentDocsUrl(locale: string): string {
  return locale === 'en'
    ? 'https://docs.openeos.de/en/ki-agenten'
    : 'https://docs.openeos.de/ki-agenten';
}

/** Die Vorschau in der Liste: Präfix plus Auslassung, nie mehr vom Geheimnis. */
export function apiTokenPreview(tokenPrefix: string): string {
  return `${tokenPrefix}…`;
}
