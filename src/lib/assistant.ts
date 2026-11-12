import { localizePlatformUrl } from '@/lib/legal';
import type { AssistantQuota, AssistantStatus } from '@/types/assistant';

/**
 * Assistent-Funktionen: was die Oberfläche aus dem Status der API ableitet.
 *
 * `available` sagt, ob der Server einen Anbieter hat; `enabled`, ob die
 * Organisation die Funktionen eingeschaltet hat. Nur beides zusammen
 * zeigt Import-Knopf und Icon-Vorschlag.
 */

/**
 * Datenschutzerklärung von OpenEOS (je Sprache). Die Adresse kommt aus
 * `GET /legal/versions` (useLegalVersions); ohne sie gilt openeos.de.
 */
export function privacyUrl(locale: string, url = 'https://openeos.de/datenschutz'): string {
  return localizePlatformUrl(url, locale);
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

/**
 * Stammt mindestens ein Vorschlag aus dem Sprachmodell? Dann trägt er die
 * Kennzeichnung „KI-generierter Vorschlag“ (Art. 50 KI-VO). Treffer aus dem
 * Icon-Verzeichnis (Wortvergleich, `lexical`) sind keine KI-Ausgabe.
 */
export function hasModelSuggestion(suggestions: readonly { source?: string }[] | null | undefined): boolean {
  return !!suggestions?.some((suggestion) => suggestion.source === 'model');
}
