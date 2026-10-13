'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { SourceCodeLink } from '@/components/shared/source-code-link';
import { localizePlatformUrl, type PublicLegalInfo } from '@/lib/legal';

type LegalKind = 'imprint' | 'privacy';

/**
 * Wohin "Impressum" bzw. "Datenschutz" des Vereins fuehrt: auf seine eigene
 * Seite (Link-Variante) oder auf die Textseite unter /s/<slug>/legal/...
 * `null`, wenn nichts hinterlegt ist oder die Textseite ohne Slug nicht
 * erreichbar waere.
 */
export function clubLegalHref(
  legal: PublicLegalInfo | null | undefined,
  kind: LegalKind,
  slug: string | null | undefined,
): { href: string; external: boolean } | null {
  if (!legal) return null;
  const url = kind === 'imprint' ? legal.imprintUrl : legal.privacyUrl;
  if (url) return { href: url, external: true };
  const text = kind === 'imprint' ? legal.imprintText : legal.privacyText;
  if (text && slug) return { href: `/s/${slug}/legal/${kind}`, external: false };
  return null;
}

export function ClubLegalLink({
  target,
  children,
  className,
}: {
  target: { href: string; external: boolean };
  children: ReactNode;
  className?: string;
}) {
  if (target.external) {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={target.href} className={className}>
      {children}
    </Link>
  );
}

/** "Bereitgestellt mit OpenEOS" mit Impressum/Datenschutz der Plattform. */
export function PoweredByOpenEos({ legal }: { legal: PublicLegalInfo | null | undefined }) {
  const t = useTranslations('publicLegal');
  const locale = useLocale();
  const imprint = legal?.platform.imprintUrl;
  const privacy = legal?.platform.privacyUrl;
  return (
    <p className="public-legal__platform">
      <span>{t('poweredBy')}</span>
      {imprint && (
        <>
          <span aria-hidden="true">·</span>
          <a href={localizePlatformUrl(imprint, locale)} target="_blank" rel="noopener noreferrer" aria-label={t('platformImprintLabel')}>
            {t('imprint')}
          </a>
        </>
      )}
      {privacy && (
        <>
          <span aria-hidden="true">·</span>
          <a href={localizePlatformUrl(privacy, locale)} target="_blank" rel="noopener noreferrer" aria-label={t('platformPrivacyLabel')}>
            {t('privacy')}
          </a>
        </>
      )}
      {/* AGPL-3.0 § 13: Quellcode auch auf den oeffentlichen Seiten anbieten */}
      <span aria-hidden="true">·</span>
      <SourceCodeLink iconSize={0} />
    </p>
  );
}

/**
 * Fusszeile der Helferseiten: oben Impressum und Datenschutz des Vereins
 * (er erhebt die Daten), darunter dezent die Plattform-Links von OpenEOS.
 * Fehlen die Angaben des Vereins, steht dort ein neutraler Hinweis statt
 * einer leeren Stelle.
 */
export function PublicLegalFooter({
  legal,
  slug,
  aside,
}: {
  legal: PublicLegalInfo | null | undefined;
  slug?: string | null;
  /** Zusaetzlicher Inhalt rechts, z. B. "Meine Schichten verwalten". */
  aside?: ReactNode;
}) {
  const t = useTranslations('publicLegal');
  const imprint = clubLegalHref(legal, 'imprint', slug);
  const privacy = clubLegalHref(legal, 'privacy', slug);
  const organization = legal?.organizationName?.trim();

  return (
    <footer className="shifts-public__footer public-legal">
      <div className="public-legal__row">
        {legal && (
          <div className="public-legal__club">
            {organization && (
              <span>{t.rich('responsible', { organization, b: (chunks) => <b>{chunks}</b> })}</span>
            )}
            {imprint && (
              <ClubLegalLink target={imprint}>{t('imprint')}</ClubLegalLink>
            )}
            {privacy && (
              <ClubLegalLink target={privacy}>{t('privacy')}</ClubLegalLink>
            )}
            {legal.contactEmail && (
              <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
            )}
            {(!imprint || !privacy) && (
              <span className="public-legal__missing">
                {!imprint && !privacy
                  ? t('missingBoth')
                  : !imprint
                    ? t('missingImprint')
                    : t('missingPrivacy')}
              </span>
            )}
          </div>
        )}
        {aside && <div className="public-legal__aside">{aside}</div>}
      </div>
      <PoweredByOpenEos legal={legal} />
    </footer>
  );
}

/**
 * Kurzer Hinweis direkt am Formular: wer die Daten verarbeitet und wo der
 * Datenschutzhinweis steht (Art. 13 DSGVO — beim Erheben).
 */
export function PrivacyFormHint({
  legal,
  slug,
  purpose,
}: {
  legal: PublicLegalInfo | null | undefined;
  slug?: string | null;
  /** Wofuer die Daten gebraucht werden, ganzer Satzteil. */
  purpose: string;
}) {
  const t = useTranslations('publicLegal');
  const organization = legal?.organizationName?.trim() || t('organizationFallback');
  const privacy = clubLegalHref(legal, 'privacy', slug);
  return (
    <p className="public-legal__form-hint">
      {privacy
        ? t.rich('formHint', {
            organization,
            purpose,
            link: (chunks) => <ClubLegalLink target={privacy}>{chunks}</ClubLegalLink>,
          })
        : t('formHintNoPrivacy', { organization, purpose })}
    </p>
  );
}
