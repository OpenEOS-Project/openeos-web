'use client';

import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { isLegalInfoComplete } from '@/lib/legal';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';

/** Wo die Einstellungen fuer Impressum/Datenschutz liegen. */
export const LEGAL_SETTINGS_HREF = '/settings?tab=org-legal';

/** Vorlage fuer den Datenschutzhinweis im Shop und auf den Helferseiten. */
export const SHOP_PRIVACY_TEMPLATE_HREF = '/legal/shop';

type LegalWarningContext = 'shop' | 'shopList' | 'shifts' | 'shiftsPublished';

/**
 * Warnt, solange der Verein kein Impressum oder keinen Datenschutzhinweis
 * hinterlegt hat — am Shop-Schalter, in der Veranstaltungsliste (Shop-Link)
 * und beim Schichtplan.
 *
 * Der Shop nimmt bis dahin keine Bestellungen an, auch im Testmodus
 * (entschieden 2026-11-06): die Pflicht liegt beim Verein, der verkauft.
 * Die Warnung sagt das deutlich und fuehrt direkt zu den Angaben bzw. zur
 * Vorlage. Die Helferseiten zeigen bei fehlenden Angaben einen neutralen
 * Hinweis.
 */
export function LegalInfoWarning({ context }: { context: LegalWarningContext }) {
  const t = useTranslations('legalWarning');
  const { currentOrganization } = useAuthStore();
  const settings = currentOrganization?.organization?.settings as OrganizationSettings | undefined;

  if (!currentOrganization || isLegalInfoComplete(settings?.legal)) return null;
  const shop = context === 'shop' || context === 'shopList';

  return (
    <div className="legal-warning" role="status" data-testid={`legal-warning-${context}`}>
      <p className="legal-warning__title">
        <TriangleAlert aria-hidden="true" />
        {t('title')}
      </p>
      <p className="legal-warning__text">{t(context)}</p>
      <div className="legal-warning__actions">
        <Link href={LEGAL_SETTINGS_HREF} className="btn btn--ghost btn--control">
          {t('action')}
        </Link>
        {shop && (
          <Link href={SHOP_PRIVACY_TEMPLATE_HREF} className="btn btn--ghost btn--control">
            {t('template')}
          </Link>
        )}
      </div>
    </div>
  );
}
