'use client';

import { useTranslations } from 'next-intl';

import { useLegalVersions } from '@/hooks/use-legal';

import '@/styles/legal.css';

/**
 * Impressum, Datenschutz und AGB von OpenEOS als leise Linkzeile (Anmeldung,
 * Registrierung). Auf eigenen Installationen gibt es diese Texte nicht.
 */
export function PlatformLegalLinks({ className }: { className?: string }) {
  const t = useTranslations('legal.links');
  const { versions, pageUrl } = useLegalVersions();
  if (!versions.enabled) return null;

  return (
    <nav className={className ? `platform-legal-links ${className}` : 'platform-legal-links'} aria-label={t('label')}>
      <a href={pageUrl('imprint')} target="_blank" rel="noopener noreferrer">
        {t('imprint')}
      </a>
      <a href={pageUrl('privacy')} target="_blank" rel="noopener noreferrer">
        {t('privacy')}
      </a>
      <a href={pageUrl('agb')} target="_blank" rel="noopener noreferrer">
        {t('agb')}
      </a>
    </nav>
  );
}
