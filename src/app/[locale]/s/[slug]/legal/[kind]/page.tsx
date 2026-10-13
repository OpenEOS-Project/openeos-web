'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { shiftsPublicApi } from '@/lib/api-client';
import { LegalText } from '@/components/public-legal/legal-text';
import { PublicLegalFooter } from '@/components/public-legal/public-legal-footer';

/**
 * Impressum bzw. Datenschutzhinweis des Vereins, wenn er sie als Text statt
 * als Link hinterlegt hat. Hat er einen Link hinterlegt, fuehrt die Seite
 * dorthin weiter (per Knopf — kein automatischer Sprung auf fremde Seiten).
 */
export default function PublicPlanLegalPage() {
  const params = useParams();
  const slug = params.slug as string;
  const kind = params.kind === 'privacy' ? 'privacy' : 'imprint';
  const t = useTranslations('publicLegal');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-shift-plan', slug],
    queryFn: () => shiftsPublicApi.getPlan(slug),
    enabled: !!slug,
    retry: false,
  });
  const plan = data?.data;
  const legal = plan?.legal;
  const text = kind === 'imprint' ? legal?.imprintText : legal?.privacyText;
  const url = kind === 'imprint' ? legal?.imprintUrl : legal?.privacyUrl;
  const title = kind === 'imprint' ? t('imprintTitle') : t('privacyTitle');

  return (
    <>
      <div className="shifts-public__logo-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dark.png" alt="OpenEOS" />
      </div>
      <main className="legal-page" style={{ flex: 1 }}>
        <Link href={`/s/${slug}`} className="shifts-public__back">
          <ArrowLeft style={{ width: 16, height: 16 }} aria-hidden="true" />
          {t('backToPlan')}
        </Link>
        <h1 className="legal-page__title">{title}</h1>
        {legal?.organizationName && <p className="legal-page__meta">{legal.organizationName}</p>}

        {isLoading ? (
          <p className="legal-page__meta">…</p>
        ) : isError || !plan ? (
          <p>{t('notAvailable')}</p>
        ) : text ? (
          <LegalText text={text} />
        ) : url ? (
          <>
            <p>{t('externalHint', { organization: legal?.organizationName ?? '' })}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn--primary" style={{ display: 'inline-flex', gap: 8 }}>
              <ExternalLink style={{ width: 16, height: 16 }} aria-hidden="true" />
              {t('openExternal')}
            </a>
          </>
        ) : (
          <p>{kind === 'imprint' ? t('missingImprint') : t('missingPrivacy')}</p>
        )}
        {legal?.contactEmail && kind === 'privacy' && (
          <p className="legal-page__meta" style={{ marginTop: 24 }}>
            {t('contact')}{' '}
            <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
          </p>
        )}
      </main>
      <PublicLegalFooter legal={legal} slug={slug} />
    </>
  );
}
