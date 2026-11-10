'use client';

import { useTranslations } from 'next-intl';

import { useLegalVersions } from '@/hooks/use-legal';
import { useReleaseVersion } from '@/hooks/use-release-version';
import { APP_VERSION } from '@/lib/version';

/**
 * Fußzeile der Kasse: © LUXCODE, Version, Impressum und Datenschutz der
 * Plattform (eigene Installationen ohne Rechtstexte zeigen keine Links).
 * Tablet quer und Desktop: eine leise Zeile unter der Kasse; Telefon und
 * Tablet hochkant: am Ende der Seite über der Warenkorb-Leiste.
 */
export function PosFooter() {
  const t = useTranslations('legal.links');
  const { versions, pageUrl } = useLegalVersions();
  // Wie die Seitenleiste: Release-Nummer, sonst die Build-Nummer.
  const version = useReleaseVersion() ?? APP_VERSION;
  const versionLabel = /^\d/.test(version) ? `v${version}` : version;

  return (
    <footer className="pos-foot">
      <span className="pos-foot__group">
        <span>&copy; {new Date().getFullYear()} LUXCODE</span>
        <span title={`Build ${APP_VERSION}`}>OpenEOS {versionLabel}</span>
      </span>
      {versions.enabled && (
        <nav className="pos-foot__group" aria-label={t('label')}>
          <a href={pageUrl('imprint')} target="_blank" rel="noopener noreferrer">
            {t('imprint')}
          </a>
          <a href={pageUrl('privacy')} target="_blank" rel="noopener noreferrer">
            {t('privacy')}
          </a>
        </nav>
      )}
    </footer>
  );
}
