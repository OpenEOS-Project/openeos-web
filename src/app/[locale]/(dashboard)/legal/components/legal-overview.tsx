'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ExternalLink, FileDown, FileText, Landmark, ShieldCheck, ShoppingBag } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useLegalStatus, useLegalVersions } from '@/hooks/use-legal';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { formatLegalVersion, LEGAL_DOCUMENT_KEYS, subprocessorsUrl } from '@/lib/legal-platform';
import { useAuthStore } from '@/stores/auth-store';
import type { LegalDocumentKey } from '@/types/legal';

import '@/styles/legal.css';

/**
 * Rechtliches: die Verträge mit OpenEOS (aktuelle und angenommene
 * Fassung), dazu die Wege zu den Angaben fürs Finanzamt und zur Vorlage
 * für den Datenschutzhinweis im Shop.
 */
export function LegalOverview() {
  const t = useTranslations('legal.overview');
  const locale = useLocale();
  const { formatDate } = useLocaleFormat();
  const { isAdmin } = usePermissions();
  const hasOrganization = !!useAuthStore((s) => s.currentOrganization);
  const { versions, localize } = useLegalVersions();
  const { data: status } = useLegalStatus(versions.enabled);

  const documentRow = (key: LegalDocumentKey) => {
    const doc = versions.documents[key];
    const accepted = key === 'agb' || key === 'avv' ? status?.documents[key] : undefined;
    return (
      <li key={key} className="legal-doc" data-testid={`legal-doc-${key}`}>
        <span className="legal-doc__icon" aria-hidden="true">
          <FileText />
        </span>
        <div className="legal-doc__main">
          <span className="legal-doc__name">{t(`documents.${key}`)}</span>
          <span className="legal-doc__links">
            <a href={localize(doc.versionUrl)} target="_blank" rel="noopener noreferrer">
              {doc.version
                ? t('current', { date: formatLegalVersion(doc.version, locale) })
                : t('currentNoDate')}
              <ExternalLink aria-hidden="true" />
            </a>
            {doc.pdfUrl && (
              <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileDown aria-hidden="true" />
                {t('pdf')}
              </a>
            )}
          </span>
          {accepted?.acceptedVersion ? (
            <span className="legal-doc__accepted">
              {t('acceptedBy', {
                version: formatLegalVersion(accepted.acceptedVersion, locale),
                date: accepted.acceptedAt ? formatDate(accepted.acceptedAt) : '–',
              })}
              {accepted.acceptedUrl && (
                <>
                  {' · '}
                  <a href={localize(accepted.acceptedUrl)} target="_blank" rel="noopener noreferrer">
                    {t('acceptedOpen')}
                  </a>
                </>
              )}
              {accepted.acceptedPdfUrl && (
                <>
                  {' · '}
                  <a href={accepted.acceptedPdfUrl} target="_blank" rel="noopener noreferrer">
                    {t('pdf')}
                  </a>
                </>
              )}
              {!accepted.upToDate && <span className="badge badge--warning">{t('outdated')}</span>}
            </span>
          ) : accepted && isAdmin ? (
            <span className="legal-doc__accepted">{t('notAccepted')}</span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <>
      {versions.enabled && (
        <section className="app-card" aria-labelledby="legal-docs-title">
          <h2 id="legal-docs-title" className="legal-card__title">
            {t('documentsTitle')}
          </h2>
          <p className="legal-card__text">{t('documentsText')}</p>
          <ul className="legal-docs">{LEGAL_DOCUMENT_KEYS.map(documentRow)}</ul>
          <p className="legal-card__more">
            <a href={localize(subprocessorsUrl(versions.documents.avv.url))} target="_blank" rel="noopener noreferrer">
              {t('subprocessors')}
              <ExternalLink aria-hidden="true" />
            </a>
          </p>
        </section>
      )}

      {versions.tseConditions && (
        <section className="app-card" aria-labelledby="legal-tse-title" data-testid="legal-tse-conditions">
          <h2 id="legal-tse-title" className="legal-card__title legal-card__title--icon">
            <ShieldCheck aria-hidden="true" />
            {t('tseConditionsTitle')}
          </h2>
          {versions.tseConditions.text ? (
            versions.tseConditions.text
              .split(/\n\s*\n/)
              .map((paragraph, index) => (
                <p key={index} className="legal-card__text legal-card__text--pre">
                  {paragraph}
                </p>
              ))
          ) : (
            <p className="legal-card__text">{t('tseConditionsPending')}</p>
          )}
          {versions.tseConditions.url && (
            <p className="legal-card__more">
              <a href={versions.tseConditions.url} target="_blank" rel="noopener noreferrer">
                {t('tseConditionsOpen')}
                <ExternalLink aria-hidden="true" />
              </a>
            </p>
          )}
        </section>
      )}

      {hasOrganization && (
        <div className="legal-tiles">
          {isAdmin && (
            <Link href="/legal/elster" className="legal-tile" data-testid="legal-tile-elster">
              <span className="legal-tile__icon" aria-hidden="true">
                <Landmark />
              </span>
              <span className="legal-tile__copy">
                <span className="legal-tile__title">{t('elsterTitle')}</span>
                <span className="legal-tile__text">{t('elsterText')}</span>
              </span>
              <ArrowRight className="legal-tile__arrow" aria-hidden="true" />
            </Link>
          )}
          <Link href="/legal/shop" className="legal-tile" data-testid="legal-tile-shop">
            <span className="legal-tile__icon" aria-hidden="true">
              <ShoppingBag />
            </span>
            <span className="legal-tile__copy">
              <span className="legal-tile__title">{t('shopTitle')}</span>
              <span className="legal-tile__text">{t('shopText')}</span>
            </span>
            <ArrowRight className="legal-tile__arrow" aria-hidden="true" />
          </Link>
        </div>
      )}
    </>
  );
}
