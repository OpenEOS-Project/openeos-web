import type { AssistantQuota, AssistantStatus } from '@/types/assistant';

/**
 * Assistent-Funktionen: was die Oberfläche aus dem Status der API ableitet.
 *
 * `available` sagt, ob der Server einen Anbieter hat; `enabled`, ob die
 * Organisation die Funktionen eingeschaltet hat. Nur beides zusammen
 * zeigt Import-Knopf und Icon-Vorschlag.
 */

/** Datenschutzerklärung auf openeos.de (je Sprache). */
export function privacyUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/privacy' : 'https://openeos.de/privacy';
}

/** Darf diese Organisation den Assistenten gerade benutzen? */
export function assistantUsable(status: AssistantStatus | null | undefined): boolean {
  return status?.available === true && status.enabled === true;
}

/**
 * Welche Zeile das Kontingent beschreibt. `exhausted`: heute nichts mehr
 * übrig; `remaining` sonst. Ohne Kontingent (alte API, Fehler) `none`.
 */
export type QuotaLine =
  | { kind: 'none' }
  | { kind: 'exhausted'; limit: number }
  | { kind: 'remaining'; remaining: number; limit: number };

export function quotaLine(quota: AssistantQuota | null | undefined): QuotaLine {
  if (!quota || !Number.isFinite(quota.limit) || quota.limit <= 0) return { kind: 'none' };
  const remaining = Math.max(0, Math.min(quota.limit, Math.floor(quota.remaining)));
  if (remaining === 0) return { kind: 'exhausted', limit: quota.limit };
  return { kind: 'remaining', remaining, limit: quota.limit };
}
