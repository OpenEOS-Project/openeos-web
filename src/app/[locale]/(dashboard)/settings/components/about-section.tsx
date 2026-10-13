'use client';

import { useTranslations } from 'next-intl';

import { SourceCodeLink } from '@/components/shared/source-code-link';
import { useReleaseVersion } from '@/hooks/use-release-version';
import { APP_VERSION } from '@/lib/version';

/** Version, Lizenz und Quellcode-Link (AGPL-3.0 § 13). */
export function AboutSection() {
  const t = useTranslations('settings.about');
  const releaseVersion = useReleaseVersion();

  return (
    <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('version')}</h3>
        <p style={{ fontSize: 14, fontFamily: 'var(--oe-f-mono)', marginTop: 4 }}>
          {releaseVersion ? `${releaseVersion} (Build ${APP_VERSION})` : APP_VERSION}
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('license')}</h3>
        <p style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{t('licenseText')}</p>
        <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>{t('sourceText')}</p>
        <p style={{ fontSize: 14, marginTop: 6 }}>
          <SourceCodeLink
            className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
            iconSize={16}
          />
        </p>
      </div>

      <div style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', lineHeight: 1.5 }}>
        <p>{t('copyright')}</p>
        <p style={{ marginTop: 4 }}>{t('thirdParty')}</p>
      </div>
    </div>
  );
}
