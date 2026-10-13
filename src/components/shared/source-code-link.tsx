'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { getSourceUrl } from '@/lib/runtime-config';

interface SourceCodeLinkProps {
  className?: string;
  /** Icon-Groesse in px; 0 blendet das Icon aus. */
  iconSize?: number;
}

/**
 * Link "Quellcode (AGPL-3.0)".
 *
 * AGPL-3.0 § 13: Wer OpenEOS (veraendert) ueber ein Netzwerk anbietet, muss
 * den Nutzer:innen den Quellcode sichtbar anbieten. Das Ziel kommt aus der
 * Laufzeit-Konfiguration (SOURCE_URL), damit Self-Hoster mit eigenen
 * Aenderungen auf ihr eigenes Repository zeigen koennen.
 */
export function SourceCodeLink({ className, iconSize = 14 }: SourceCodeLinkProps) {
  const t = useTranslations('common.sourceCode');

  return (
    <a
      href={getSourceUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={t('title')}
    >
      {iconSize > 0 && <Icon name="code" size={iconSize} />}
      <span>{t('label')}</span>
    </a>
  );
}
