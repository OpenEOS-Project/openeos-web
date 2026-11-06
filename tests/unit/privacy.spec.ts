import { expect, test } from '@playwright/test';

import de from '@/messages/de.json';
import en from '@/messages/en.json';
import {
  confirmationMatches,
  finalDeletionDue,
  isReadOnlyOrganization,
  organizationClosure,
} from '@/lib/privacy';
import type { OrganizationClosure } from '@/types/organization';

const closure = (o: Partial<OrganizationClosure> = {}): OrganizationClosure => ({
  closedAt: '2026-11-01T10:00:00.000Z',
  finalDeletionAt: '2026-12-01T10:00:00.000Z',
  purged: false,
  readOnly: true,
  ...o,
});

test.describe('privacy: closed organizations', () => {
  test('active organizations are not read-only', () => {
    expect(isReadOnlyOrganization({ closure: null })).toBe(false);
    expect(isReadOnlyOrganization(undefined)).toBe(false);
    expect(organizationClosure({ closure: undefined })).toBeNull();
  });

  test('closed but not purged organizations are read-only', () => {
    expect(isReadOnlyOrganization({ closure: closure() })).toBe(true);
    expect(isReadOnlyOrganization({ closure: closure({ purged: true }) })).toBe(false);
  });

  test('final deletion date reached', () => {
    expect(finalDeletionDue(closure(), new Date('2026-11-30T00:00:00Z'))).toBe(false);
    expect(finalDeletionDue(closure(), new Date('2026-12-01T10:00:00Z'))).toBe(true);
  });
});

test.describe('privacy: typed confirmation', () => {
  test('needs the exact name, outer spaces ignored', () => {
    expect(confirmationMatches('SV Blau-Weiß', 'SV Blau-Weiß')).toBe(true);
    expect(confirmationMatches('SV Blau-Weiß', '  SV Blau-Weiß ')).toBe(true);
    expect(confirmationMatches('SV Blau-Weiß', 'sv blau-weiß')).toBe(false);
    expect(confirmationMatches('SV Blau-Weiß', '')).toBe(false);
    expect(confirmationMatches('  ', '  ')).toBe(false);
  });
});

test.describe('privacy: translations', () => {
  const reasons = [
    'ORGANIZATION_READ_ONLY',
    'ORGANIZATION_CLOSED',
    'ORGANIZATION_ALREADY_PURGED',
    'ORGANIZATION_PURGE_BLOCKED',
    'ORGANIZATION_PURGE_CONFIRMATION_MISMATCH',
    'ACCOUNT_DELETION_BLOCKED',
    'ACCOUNT_DELETION_CODE_INVALID',
    'ACCOUNT_DELETION_CONFIRMATION_REQUIRED',
    'ACCOUNT_DELETION_PASSWORD_INVALID',
    'ACCOUNT_DELETION_SUPER_ADMIN',
    'ACCOUNT_DELETION_UNCLOSED_TRANSACTIONS',
    'NEWSLETTER_TOKEN_INVALID',
  ];
  test('every new API reason is translated in German and English', () => {
    for (const reason of reasons) {
      expect((de.apiErrors as Record<string, string>)[reason], reason).toBeTruthy();
      expect((en.apiErrors as Record<string, string>)[reason], reason).toBeTruthy();
    }
  });

  test('the banner uses the wording of the legal texts', () => {
    expect(de.privacy.closure.title).toBe(
      'Diese Organisation wird am {date} endgültig gelöscht. Du kannst bis dahin alle Daten exportieren.',
    );
  });

  test('German and English have the same privacy keys', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(en.privacy).sort()).toEqual(keys(de.privacy).sort());
  });
});
