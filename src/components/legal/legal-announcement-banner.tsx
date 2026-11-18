'use client';

import { useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { ExternalLink, FileText, X } from 'lucide-react';

import {
  useDismissLegalAnnouncement,
  useLegalVersions,
  useUpcomingLegalChanges,
} from '@/hooks/use-legal';

import { formatLegalVersion } from '@/lib/legal-platform';

import type { LegalDocumentKey, UpcomingLegalChange } from '@/types/legal';

/** Reihenfolge der Dokumente in Titel und Links. */
const ORDER: LegalDocumentKey[] = ['agb', 'anlage1', 'avv', 'privacy', 'imprint'];

/**
 * Hinweis auf angekündigte neue Fassungen der Rechtstexte – für Admins,
 * von der Ankündigung bis zum Inkrafttreten. Blockiert nichts und lässt
 * sich je Ankündigung ausblenden (gespeichert am Konto).
 */
export function LegalAnnouncementBanner() {
  const { data: changes } = useUpcomingLegalChanges();
  if (!changes?.length) return null;
  return (
    <>
      {changes.map((change) => (
        <AnnouncementNotice key={change.id} change={change} />
      ))}
    </>
  );
}

function AnnouncementNotice({ change }: { change: UpcomingLegalChange }) {
  const t = useTranslations('legal.announcement');
  const locale = useLocale();
  const { localize } = useLegalVersions();
  const dismiss = useDismissLegalAnnouncement();
  const [open, setOpen] = useState(false);

  const documents = ORDER.filter((d) => change.documents.includes(d));
  const names = documents.map((d) => t(`documents.${d}`));
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} ${t('and')} ${names[names.length - 1]}`
      : (names[0] ?? '');
  const date = formatLegalVersion(change.version, locale);
  const summary = locale.startsWith('en') && change.summaryEn ? change.summaryEn : change.summaryDe;
  const contract = documents.some((d) => d === 'agb' || d === 'anlage1' || d === 'avv');
  const detailsId = `legal-announcement-${change.id}`;

  return (
    <div
      className="oe-banner oe-banner--info legal-announcement"
      role="status"
      data-testid="legal-announcement-banner"
    >
      <span className="oe-banner__ico" aria-hidden="true">
        <FileText />
      </span>
      <div className="legal-announcement__body">
        <b>{t('title', { documents: list, date })}</b>
        <p className="legal-announcement__text">
          {contract ? t('textContract', { date }) : t('textInfo', { date })}{' '}
          <button
            type="button"
            className="legal-announcement__toggle"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
            data-testid="legal-announcement-toggle"
          >
            {open ? t('hideSummary') : t('showSummary')}
          </button>
        </p>
        {open && (
          <div id={detailsId} className="legal-announcement__details">
            <p className="legal-announcement__summary">{summary}</p>
            <ul className="legal-announcement__links">
              {documents.map((d) => {
                const links = change.links[d];
                if (!links) return null;
                return (
                  <li key={d}>
                    <a href={localize(links.versionUrl)} target="_blank" rel="noopener noreferrer">
                      {t('newVersion', { document: t(`documents.${d}`) })}
                      <ExternalLink aria-hidden="true" />
                    </a>
                    {links.previousUrl && (
                      <>
                        {' · '}
                        <a
                          href={localize(links.previousUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('previousVersion')}
                        </a>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {contract && (
              <p className="legal-announcement__note">
                {t(change.explicitConsent ? 'consentNote' : 'objectionNote')}
              </p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="legal-announcement__dismiss"
        aria-label={t('dismiss')}
        title={t('dismiss')}
        disabled={dismiss.isPending}
        onClick={() => dismiss.mutate(change.id)}
        data-testid="legal-announcement-dismiss"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
