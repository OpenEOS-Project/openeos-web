'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, ExternalLink, FileText, LogOut } from 'lucide-react';

import { useAcceptLegal, useLegalStatus, useLegalVersions } from '@/hooks/use-legal';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { formatLegalVersion } from '@/lib/legal-platform';
import { useAuthStore } from '@/stores/auth-store';
import type { AcceptableLegalDocument, LegalAcceptanceState } from '@/types/legal';

import '@/styles/legal.css';

/** Adresse für Widerspruch und Zustimmung in Textform (AGB 14.1). */
const CONTACT_EMAIL = 'hello@openeos.de';

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
  const [postponedUntil, setPostponedUntil] = useState<number | null>(null);
  const change = status?.change ?? null;
  /* Gilt die Änderung nach AGB 13.4 auch ohne Bestätigung (Widerspruchs-
     lösung), lässt sich die Frage verschieben – wer widerspricht, nutzt
     OpenEOS zu den bisherigen Bedingungen weiter. */
  const postponable = !!change && !change.explicitConsent;
  const key = user && change ? postponeKey(user.id, change.version) : null;

  useEffect(() => {
    if (!key) return;
    try {
      const stored = Number(window.localStorage.getItem(key));
      setPostponedUntil(Number.isFinite(stored) && stored > 0 ? stored : null);
    } catch {
      setPostponedUntil(null);
    }
  }, [key]);

  const postpone = useCallback(() => {
    if (!key) return;
    const until = Date.now() + POSTPONE_MS;
    try {
      window.localStorage.setItem(key, String(until));
    } catch {
      // Ohne Speicher gilt das Verschieben nur bis zum Neuladen.
    }
    setPostponedUntil(until);
  }, [key]);

  const postponed = postponable && postponedUntil !== null && postponedUntil > Date.now();
  return {
    open: active && (flag === true || status?.required === true) && !postponed,
    status,
    postponable,
    postpone,
  };
}

/** „Später erinnern“: einen Tag Ruhe, dann fragt der Dialog wieder. */
const POSTPONE_MS = 24 * 60 * 60 * 1000;

function postponeKey(userId: string, version: string): string {
  return `openeos.legal.reacceptance.later.${userId}.${version}`;
}

/**
 * Neue AGB oder neuer AVV: Admins einer Organisation bestätigen sie, sobald
 * die neue Fassung gilt.
 *
 * Kam die Fassung mit einer Ankündigung, nennt der Dialog, seit wann sie
 * gilt, was sich ändert und – nach AGB 13.4 – das Widerspruchsrecht; dann
 * lässt sich die Frage um einen Tag verschieben. Braucht die Änderung die
 * ausdrückliche Zustimmung (oder fehlt eine Ankündigung), bleibt er ohne
 * Schließen-Knopf und ohne Escape — wer nicht zustimmen will, kann sich
 * abmelden.
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
  const { open, status, postponable, postpone } = useLegalReacceptance();
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
  const change = status?.change ?? null;
  const since = change ? formatLegalVersion(change.version, locale) : null;
  const summary = change ? (locale.startsWith('en') && change.summaryEn ? change.summaryEn : change.summaryDe) : null;
  const outdated = (['agb', 'avv'] as const).filter((doc) => status?.documents[doc] && !status.documents[doc].upToDate);
  const title =
    outdated.length === 1 ? t(outdated[0] === 'agb' ? 'titleAgb' : 'titleAvv') : t('title');

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
          // Kein Schließen per Escape: dafür gibt es „Später erinnern“ (falls erlaubt).
          if (e.key === 'Escape') e.stopPropagation();
        }}
      >
        <div className="changelog-dialog__head">
          <h2 id={titleId} className="changelog-dialog__title">
            {title}
          </h2>
          <p className="changelog-dialog__sub">
            {since ? t('subtitleSince', { date: since }) : stand ? t('subtitle', { date: stand }) : t('subtitleNoDate')}
          </p>
        </div>

        <div className="changelog-dialog__body legal-accept__body">
          {change ? (
            <>
              <p className="legal-accept__text">
                {t('textSince', { date: since ?? '', announced: formatDate(change.announcedAt) })}
              </p>
              {summary && (
                <p className="legal-accept__summary" data-testid="legal-reacceptance-summary">
                  {summary}
                </p>
              )}
            </>
          ) : (
            <p className="legal-accept__text">{t('text')}</p>
          )}
          <ul className="legal-accept__docs">{(['agb', 'avv'] as const).map(documentRow)}</ul>
          {change && (
            <p className="legal-accept__note" data-testid="legal-reacceptance-objection">
              {change.explicitConsent
                ? t('consentNote', { email: CONTACT_EMAIL })
                : t('objectionNote', { email: CONTACT_EMAIL })}
            </p>
          )}
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
          {postponable ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={postpone}
              disabled={accept.isPending}
              data-testid="legal-reacceptance-later"
            >
              <Clock aria-hidden="true" />
              <span>{t('later')}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => void logout()} disabled={accept.isPending}>
              <LogOut aria-hidden="true" />
              <span>{t('logout')}</span>
            </button>
          )}
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
