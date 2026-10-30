/**
 * Zugänge (API-Tokens) einer Organisation, ki-plan.md Abschnitt 8.
 *
 * Die Formen spiegeln `src/modules/api-tokens/**` in openeos-api:
 * `ApiTokenView` dort heißt hier `ApiToken`; der Klartext (`token`) kommt
 * nur in der Antwort auf das Anlegen und wird nie wieder gezeigt.
 */

export type ApiTokenScope =
  | 'read'
  | 'catalog:write'
  | 'events:write'
  | 'tables:write'
  | 'staff:write'
  | 'devices:write'
  | 'settings:write'
  | 'monitoring:read';

/** Scopes, die ein Organisations-Token tragen darf (Reihenfolge wie im Dialog). */
export const ORGANIZATION_TOKEN_SCOPES: readonly ApiTokenScope[] = [
  'read',
  'catalog:write',
  'events:write',
  'tables:write',
  'staff:write',
  'devices:write',
  'settings:write',
];

export interface ApiToken {
  id: string;
  name: string;
  /** Die ersten 12 Zeichen des Klartexts, z. B. `oeos_JGScPub`. */
  tokenPrefix: string;
  userId: string;
  organizationId: string;
  /** Aussteller; `null`, wenn das Konto nicht mehr existiert. */
  createdBy: { id: string; firstName: string; lastName: string } | null;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Antwort auf das Anlegen: der Eintrag plus der Klartext, genau einmal. */
export interface CreatedApiToken extends ApiToken {
  token: string;
}

export interface CreateApiTokenInput {
  /** 1–100 Zeichen. */
  name: string;
  /** Mindestens einer; Schreib-Scopes schließen `read` nicht ein. */
  scopes: ApiTokenScope[];
  /** ISO-8601; ohne Angabe läuft der Zugang nie ab. */
  expiresAt?: string;
}

export type ApiTokenStatus = 'active' | 'expired' | 'revoked';
