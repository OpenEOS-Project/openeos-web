import type { Organization, OrganizationClosure } from '@/types/organization';

/**
 * Datenschutz zum Selbstbedienen: Nur-lesen-Zugang gelöschter
 * Organisationen, „Konto löschen“, Newsletter-Einwilligung.
 */

/** Löschzustand einer Organisation, `null` solange sie aktiv ist. */
export function organizationClosure(
  organization: Pick<Organization, 'closure'> | null | undefined,
): OrganizationClosure | null {
  return organization?.closure ?? null;
}

/** Nur lesend nutzbar (gelöscht, aber noch nicht endgültig). */
export function isReadOnlyOrganization(
  organization: Pick<Organization, 'closure'> | null | undefined,
): boolean {
  const closure = organizationClosure(organization);
  return !!closure && !closure.purged;
}

/** Termin der endgültigen Löschung schon erreicht (Löschlauf steht noch aus). */
export function finalDeletionDue(closure: OrganizationClosure, now = new Date()): boolean {
  return new Date(closure.finalDeletionAt).getTime() <= now.getTime();
}

/** Bestätigung durch Eintippen des Namens: wie die API, Leerzeichen am Rand egal. */
export function confirmationMatches(expected: string, typed: string): boolean {
  return typed.trim().length > 0 && typed.trim() === expected.trim();
}

/** Mindestlänge des Anlasses für die sofortige endgültige Löschung (API: 10). */
export const PURGE_REASON_MIN_LENGTH = 10;

export interface NewsletterStatus {
  subscribed: boolean;
  consentedAt: string | null;
  withdrawnAt: string | null;
  emailVerified: boolean;
}

export type AccountDeletionBlockReason = 'members' | 'active_events' | 'tse_active';

export interface AccountDeletionStatus {
  allowed: boolean;
  confirmation: 'password' | 'email_code';
  superAdmin: boolean;
  unclosedTransactions: boolean;
  blockers: Array<{ organizationId: string; name: string; reason: AccountDeletionBlockReason }>;
  closesOrganizations: Array<{ organizationId: string; name: string }>;
}
