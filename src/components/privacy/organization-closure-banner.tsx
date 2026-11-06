'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { finalDeletionDue, isReadOnlyOrganization } from '@/lib/privacy';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Hinweis über jeder Seite einer gelöschten Organisation (AGB 10.4): bis zur
 * endgültigen Löschung ist sie nur noch lesend nutzbar, Exporte gehen
 * weiter. Die API lehnt jede Änderung ab (ORGANIZATION_READ_ONLY) – der
 * Hinweis erklärt, warum.
 */
export function OrganizationClosureBanner() {
  const t = useTranslations('privacy.closure');
  const { formatDate } = useLocaleFormat();
  const organization = useAuthStore((s) => s.currentOrganization?.organization);
  if (!organization || !isReadOnlyOrganization(organization)) return null;
  const closure = organization.closure!;
  const due = finalDeletionDue(closure);

  return (
    <div className="oe-banner oe-banner--warn privacy-closure-banner" role="status" data-testid="organization-closure-banner">
      <span className="oe-banner__ico">
        <Icon name="alert" />
      </span>
      <div>
        <b>
          {due
            ? t('titleDue')
            : t('title', { date: formatDate(closure.finalDeletionAt) })}
        </b>
        <p style={{ margin: '4px 0 0' }}>{t('text', { closedAt: formatDate(closure.closedAt) })}</p>
      </div>
    </div>
  );
}
