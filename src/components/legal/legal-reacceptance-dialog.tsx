'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, FileText, LogOut } from 'lucide-react';

import { useAcceptLegal, useLegalStatus, useLegalVersions } from '@/hooks/use-legal';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { formatLegalVersion } from '@/lib/legal-platform';
import { useAuthStore } from '@/stores/auth-store';
import type { AcceptableLegalDocument, LegalAcceptanceState } from '@/types/legal';

import '@/styles/legal.css';

/**
 * Steht die Annahme neuer AGB/AVV aus? Dann wartet alles andere, was sich
 * über das Dashboard legt (Willkommens-Tour, Neuerungen) — sonst stünde es
 * über dem Hinweis und finge die Klicks ab.
 *
 * Ob es nötig ist, meldet `/auth/me` und schon die Antwort der Anmeldung
 * (`legalReacceptanceRequired`) — direkt nach dem Login braucht es also
 * keinen Extra-Aufruf. Fehlt das Feld (ältere API, Antworten wie die der
 * Profiländerung), zählt `/legal/status`.
 */
export function useLegalReacceptance() {
  const user = useAuthStore((s) => s.user);
  const { versions, isLoaded } = useLegalVersions();
  const flag = user?.legalReacceptanceRequired;
  const active = !!user && isLoaded && versions.enabled && flag !== false;
  const { data: status } = useLegalStatus(active);
  return { open: active && (flag === true || status?.required === true), status };
}

/**
 * Neue AGB oder neuer AVV: Admins einer Organisation nehmen sie an, bevor
 * es im Dashboard weitergeht.
 *
 * Bewusst ohne Schließen-Knopf und ohne Escape — wer nicht zustimmen will,
 * kann sich abmelden.
 */
export function LegalReacceptanceDialog() {
  const t = useTranslations('legal.reacceptance');
  const locale = useLocale();
  const { formatDate } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const titleId = useId();
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  const logout = useAuthStore((s) => s.logout);
  const { versions, localize } = useLegalVersions();
  const { open, status } = useLegalReacceptance();
  const accept = useAcceptLegal();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) checkboxRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const onAccept = async () => {
    setError(null);
    try {
      await accept.mutateAsync({ context: 'reacceptance' });
    } catch (err) {
      setError(apiErrorMessage(err, t('error')));
    }
  };

  const stand = formatLegalVersion(versions.documents.agb.version ?? versions.documents.avv.version, locale);

  const documentRow = (doc: AcceptableLegalDocument) => {
    const current = versions.documents[doc];
    const previous: LegalAcceptanceState | undefined = status?.documents[doc];
    const outdated = previous && !previous.upToDate;
    return (
      <li key={doc} className="legal-accept__doc">
        <span className="legal-accept__doc-icon" aria-hidden="true">
          <FileText />
        </span>
        <div className="legal-accept__doc-text">
          <a href={localize(current.versionUrl)} target="_blank" rel="noopener noreferrer" className="legal-accept__doc-title">
            {t(`documents.${doc}`)}
            <ExternalLink aria-hidden="true" />
          </a>
          <span className="legal-accept__doc-meta">
            {current.version ? t('version', { date: formatLegalVersion(current.version, locale) }) : t('currentVersion')}
            {current.pdfUrl && (
              <>
                {' · '}
                <a href={current.pdfUrl} target="_blank" rel="noopener noreferrer">
                  {t('pdf')}
                </a>
              </>
            )}
          </span>
          {outdated && previous.acceptedVersion && (
            <span className="legal-accept__doc-meta">
              {previous.acceptedUrl ? (
                <a href={localize(previous.acceptedUrl)} target="_blank" rel="noopener noreferrer">
                  {t('previous', { date: formatLegalVersion(previous.acceptedVersion, locale) })}
                </a>
              ) : (
                t('previous', { date: formatLegalVersion(previous.acceptedVersion, locale) })
              )}
              {previous.acceptedAt && <> · {t('acceptedOn', { date: formatDate(previous.acceptedAt) })}</>}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="changelog-dialog__scrim legal-accept__scrim" role="presentation">
      <div
        className="changelog-dialog legal-accept"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="legal-reacceptance-dialog"
        onKeyDown={(e) => {
          // Kein Schließen per Escape: die Annahme ist Voraussetzung.
          if (e.key === 'Escape') e.stopPropagation();
        }}
      >
        <div className="changelog-dialog__head">
          <h2 id={titleId} className="changelog-dialog__title">
            {t('title')}
          </h2>
          <p className="changelog-dialog__sub">{stand ? t('subtitle', { date: stand }) : t('subtitleNoDate')}</p>
        </div>

        <div className="changelog-dialog__body legal-accept__body">
          <p className="legal-accept__text">{t('text')}</p>
          <ul className="legal-accept__docs">{(['agb', 'avv'] as const).map(documentRow)}</ul>
          {locale.startsWith('en') && <p className="legal-accept__note">{t('germanNote')}</p>}

          <label className="auth-check auth-check--block legal-accept__check">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              data-testid="legal-reacceptance-checkbox"
            />
            <span>{t('checkbox')}</span>
          </label>

          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="changelog-dialog__foot legal-accept__foot">
          <button type="button" className="btn btn--ghost" onClick={() => void logout()} disabled={accept.isPending}>
            <LogOut aria-hidden="true" />
            <span>{t('logout')}</span>
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void onAccept()}
            disabled={!checked || accept.isPending}
            data-testid="legal-reacceptance-accept"
          >
            {accept.isPending ? t('saving') : t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
