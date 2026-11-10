'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { NoticeBanner } from '@/components/shared/operating-mode-notices';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { reportsApi } from '@/lib/api-client';
import { smallBusinessNotice } from '@/lib/vat-status';
import { useAuthStore } from '@/stores/auth-store';

/** Einstellungen → Organisation → Allgemein (Schalter „Keine Umsatzsteuer“). */
export const VAT_STATUS_SETTINGS_HREF = '/settings?tab=org-general';

/**
 * Kleinunternehmer (§ 19 UStG) nahe an oder über der Umsatzgrenze: Hinweis
 * im Dashboard mit dem Umsatz in OpenEOS (nur ein Anhaltspunkt — Umsätze
 * außerhalb fehlen). Braucht das Recht „Auswertung“; ohne (403) oder bei
 * älteren API-Versionen bleibt er still.
 */
export function SmallBusinessHint({ organizationId, orderOnly }: { organizationId: string; orderOnly: boolean }) {
  const t = useTranslations('dashboard.smallBusiness');
  const { formatCurrency } = useLocaleFormat();
  const { hasPermission, isAdmin } = usePermissions();
  const vatExempt = useAuthStore((state) => state.currentOrganization?.organization?.settings?.vatExempt !== false);
  const enabled = !!organizationId && vatExempt && !orderOnly && hasPermission('reports');

  const status = useQuery({
    queryKey: ['reports', organizationId, 'small-business'],
    queryFn: async () => (await reportsApi.getSmallBusiness(organizationId)).data,
    enabled,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const notice = enabled ? smallBusinessNotice(status.data) : null;
  if (!notice) return null;

  const values = {
    revenue: formatCurrency(notice.revenue),
    limit: formatCurrency(notice.limit),
    percent: notice.percent,
  };
  const key = notice.kind === 'approaching' ? 'approaching' : notice.basis === 'previous' ? 'exceededPrevious' : 'exceeded';

  return (
    <NoticeBanner tone={notice.kind === 'exceeded' ? 'warn' : 'info'} title={t(`${key}.title`)} testId="small-business-hint">
      <p className="mode-notice__p">{t(`${key}.text`, values)}</p>
      <p className="mode-notice__p mode-notice__muted">
        {t('onlyOpeneos')}
        {isAdmin && (
          <>
            {' · '}
            <Link href={VAT_STATUS_SETTINGS_HREF} className="notice-link">
              {t('settingsLink')}
            </Link>
          </>
        )}
      </p>
    </NoticeBanner>
  );
}
