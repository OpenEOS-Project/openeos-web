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
  /** Termin der endgültigen Löschung, wenn jetzt gelöscht wird und Organisationen mitgehen. */
  scheduledDeletionAt: string | null;
  /** Bereits geplante Löschung von Konto und Organisationen. */
  scheduled: ScheduledAccountDeletion | null;
}

export interface ScheduledAccountDeletion {
  requestedAt: string;
  dueAt: string;
  organizations: Array<{ organizationId: string; name: string }>;
}

export type AccountDeletionResult =
  | { deleted: true; scheduled: false; runId: string }
  | {
      deleted: false;
      scheduled: true;
      dueAt: string;
      organizations: Array<{ organizationId: string; name: string }>;
      runId: string;
    };

/** Namen für Texte: „A“, „B“. */
export function quotedNames(items: Array<{ name: string }>): string {
  return items.map((o) => `„${o.name}“`).join(', ');
}

/** Konto mit geplanter Löschung (nur noch anmelden und exportieren). */
export function accountDeletionScheduled(user: { deletionDueAt?: string | null } | null | undefined): boolean {
  return !!user?.deletionDueAt;
}

/** Eintrag im Protokoll der Löschungen (GET /admin/retention/runs). */
export interface RetentionRunEntry {
  id: string;
  category: string;
  trigger: 'scheduled' | 'manual' | 'instruction' | 'self_service' | 'club';
  dryRun: boolean;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  counts: Record<string, number>;
  total: number;
  error: string | null;
  organizationId: string | null;
  organizationName: string | null;
  executedByUserId: string | null;
  executedBy: { id: string; name: string; email: string } | null;
  reason: string | null;
  details: Record<string, unknown> | null;
}

export const RETENTION_TRIGGERS = ['scheduled', 'manual', 'instruction', 'club', 'self_service'] as const;

/** Zahlen eines Eintrags ohne Nullen, größte zuerst. */
export function nonZeroCounts(counts: Record<string, number>): Array<[string, number]> {
  return Object.entries(counts)
    .filter(([, n]) => typeof n === 'number' && n !== 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
