'use client';

import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { isLegalInfoComplete } from '@/lib/legal';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationSettings } from '@/types/organization';

/** Wo die Einstellungen fuer Impressum/Datenschutz liegen. */
export const LEGAL_SETTINGS_HREF = '/settings?tab=org-legal';

/**
 * Warnt, solange der Verein kein Impressum oder keinen Datenschutzhinweis
 * hinterlegt hat — am Shop-Schalter und beim Schichtplan.
 *
 * Bewusst nur eine Warnung und keine Sperre: die Pflicht liegt beim Verein,
 * manche haben ihre Angaben anderswo (Vereinswebsite, Aushang), und eine
 * Sperre wuerde eine laufende Veranstaltung lahmlegen. Die oeffentlichen
 * Seiten zeigen bei fehlenden Angaben einen neutralen Hinweis.
 */
export function LegalInfoWarning({ context }: { context: 'shop' | 'shifts' }) {
  const t = useTranslations('legalWarning');
  const { currentOrganization } = useAuthStore();
  const settings = currentOrganization?.organization?.settings as OrganizationSettings | undefined;

  if (!currentOrganization || isLegalInfoComplete(settings?.legal)) return null;

  return (
    <div className="legal-warning" role="status">
      <p className="legal-warning__title">
        <TriangleAlert aria-hidden="true" />
        {t('title')}
      </p>
      <p className="legal-warning__text">{t(context)}</p>
      <Link href={LEGAL_SETTINGS_HREF} className="btn btn--ghost btn--control legal-warning__action">
        {t('action')}
      </Link>
    </div>
  );
}
