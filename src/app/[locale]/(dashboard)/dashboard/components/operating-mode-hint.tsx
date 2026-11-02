'use client';

import { useTranslations } from 'next-intl';

import { useDeployment } from '@/components/providers/setup-provider';
import { LegacyNotice, SetCountryNotice } from '@/components/shared/operating-mode-notices';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/routing';
import { dashboardNoticeKind, OPERATING_MODE_SETTINGS_HREF } from '@/lib/operating-mode';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Hinweis im Dashboard (nicht wegklickbar, solange er gilt):
 * - ohne Land: Bitte, das Land einmal festzulegen,
 * - Bestand in Deutschland: TSE-Pflicht und Bitte um die Wahl der
 *   Betriebsart (kein automatischer Wechsel).
 * Nur für Admins – sie legen Land und Betriebsart fest. Auf einer eigenen
 * Installation entfällt der Bestand-Hinweis (dort Normalfall).
 * Länderhinweise und die sanfte Bitte für Bestand außerhalb Deutschlands
 * stehen nur in Einstellungen → Organisation → Betriebsart.
 */
export function OperatingModeHint() {
  const t = useTranslations('operatingMode');
  const organization = useAuthStore((state) => state.currentOrganization?.organization);
  const { isAdmin } = usePermissions();
  // Eigene Installation: Bestand ist dort der Normalfall (kein Hinweis darauf).
  const selfHosted = useDeployment().mode === 'selfhosted';
  const kind = dashboardNoticeKind(organization);
  if (!kind || !isAdmin || (selfHosted && kind === 'legacy_de')) return null;

  const settingsLink = (
    <Link href={OPERATING_MODE_SETTINGS_HREF} className="notice-link">
      {t('settingsLink')}
    </Link>
  );

  if (kind === 'set_country') {
    return <SetCountryNotice isAdmin action={organization?.operatingModeLegacy ? settingsLink : undefined} />;
  }
  return <LegacyNotice kind="de" hasCountry isAdmin action={settingsLink} />;
}
