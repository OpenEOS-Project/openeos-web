'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import type { EmergencySupportInfo } from '@/types/support';

/**
 * Notfall-Support am Veranstaltungstag (AGB 18.2): Rufnummer als
 * `tel:`-Link und der Hinweis, wofür sie da ist. Markup wie <NoticeBanner>
 * (operating-mode-notices.tsx), aber mit Link in der Überschrift.
 */
export function EmergencySupportNotice({ info }: { info: Pick<EmergencySupportInfo, 'phone' | 'telUri'> }) {
  const t = useTranslations('support.emergency');
  if (!info.phone || !info.telUri) return null;
  return (
    <div className="mode-notice" data-testid="emergency-support">
      <div className="oe-banner oe-banner--warn" role="note">
        <span className="oe-banner__ico">
          <Icon name="alert" />
        </span>
        <div className="mode-notice__content">
          <b>
            {t('title')}{' '}
            <a href={info.telUri} className="notice-link emergency-phone">
              {info.phone}
            </a>
          </b>
          <p className="mode-notice__p">{t('text')}</p>
        </div>
      </div>
    </div>
  );
}
