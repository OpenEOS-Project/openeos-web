'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Flag } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { contentReportsApi } from '@/lib/content-reports-api';
import { localizePlatformUrl } from '@/lib/legal';
import { legalApi } from '@/lib/legal-api';
import { CONTENT_REPORT_REASONS, type ContentReportReason } from '@/types/content-report';

import '@/styles/content-report.css';

/** Die Fundstelle muss eine Adresse sein — sonst lässt sie sich nicht zuordnen. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * „Inhalt melden“: Meldung rechtswidriger Inhalte in Shops und auf
 * Helferseiten (Melde- und Abhilfeverfahren nach Art. 16 DSA). Ohne
 * Anmeldung und ohne Captcha; gegen Missbrauch helfen ein unsichtbares
 * Feld, eine Mindestzeit und Grenzen in der API.
 */
function ReportForm() {
  const t = useTranslations('contentReport');
  const ta = useTranslations('publicA11y');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const params = useSearchParams();
  const startedAt = useMemo(() => Date.now(), []);

  const [url, setUrl] = useState('');
  const [reason, setReason] = useState<ContentReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  /** Fehler an den Feldern erst nach dem ersten Absenden zeigen. */
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);
  useEffect(() => {
    const prefill = params.get('url');
    if (prefill && isHttpUrl(prefill)) setUrl(prefill);
  }, [params]);

  /* Kontaktstelle und Datenschutzerklärung der Plattform aus der API —
     eigene Installationen nennen dort ihre eigene Adresse (oder keine). */
  const { data: platform } = useQuery({
    queryKey: ['legal', 'versions', 'platform'],
    queryFn: async () => {
      const res = await legalApi.versions();
      return (res.data as unknown as {
        platform?: { contactEmail?: string | null; privacyUrl?: string | null } | null;
      }).platform ?? null;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const contactEmail = platform?.contactEmail || null;
  const privacyUrl = platform?.privacyUrl ? localizePlatformUrl(platform.privacyUrl, locale) : null;

  /* Fehler je Feld, am Feld angezeigt und per aria-describedby verknüpft
     (WCAG 3.3.1, 3.3.3). Der Absenden-Button bleibt bedienbar. */
  const fieldErrors = {
    url: isHttpUrl(url) ? null : ta('report.url'),
    reason: reason ? null : ta('report.reason'),
    description: description.trim().length >= 20 ? null : ta('report.description'),
    name: name.trim().length >= 2 ? null : ta('report.name'),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : ta('report.email'),
    goodFaith: goodFaith ? null : ta('report.goodFaith'),
  };
  type Field = keyof typeof fieldErrors;
  const valid = Object.values(fieldErrors).every((e) => !e);
  const fieldError = (key: Field) => (attempted ? fieldErrors[key] : null);
  const describedBy = (key: Field, hint?: string) =>
    [fieldError(key) ? `report-${key}-error` : null, hint].filter(Boolean).join(' ') || undefined;
  const ids: Record<Field, string> = {
    url: 'report-url',
    reason: 'report-reason',
    description: 'report-description',
    name: 'report-name',
    email: 'report-email',
    goodFaith: 'report-good-faith',
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !reason) {
      setAttempted(true);
      setError(null);
      const first = (Object.keys(fieldErrors) as Field[]).find((key) => fieldErrors[key]);
      if (first) formRef.current?.querySelector<HTMLElement>(`#${ids[first]}`)?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await contentReportsApi.submit({
        url: url.trim(),
        reason,
        description: description.trim(),
        name: name.trim(),
        email: email.trim(),
        goodFaith,
        website,
        startedAt,
      });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, t('failed')));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="content-report">
      <header className="content-report__head">
        <Image src="/logo_dark.png" alt="OpenEOS" width={100} height={28} style={{ height: 28, width: 'auto' }} />
      </header>

      <main className="content-report__main">
        <div className="app-card content-report__card">
          {sent ? (
            <div className="content-report__done" role="status" data-testid="content-report-sent">
              <CircleCheck aria-hidden="true" />
              <h1 ref={sentRef} tabIndex={-1}>
                {t('sentTitle')}
              </h1>
              <p>{t('sentText')}</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate ref={formRef}>
              <div className="content-report__title">
                <Flag aria-hidden="true" />
                <h1>{t('title')}</h1>
              </div>
              <p className="content-report__intro">{t('intro')}</p>
              <p className="content-report__hint">{ta('requiredHint')}</p>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-url">
                  {t('url')} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="report-url"
                  className="input"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  required
                  aria-invalid={fieldError('url') ? true : undefined}
                  aria-describedby={describedBy('url', 'report-url-hint')}
                />
                <FieldError id="report-url-error" message={fieldError('url')} />
                <p className="content-report__hint" id="report-url-hint">{t('urlHint')}</p>
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-reason">
                  {t('reason')} <span aria-hidden="true">*</span>
                </label>
                <select
                  id="report-reason"
                  className="select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ContentReportReason)}
                  required
                  aria-invalid={fieldError('reason') ? true : undefined}
                  aria-describedby={describedBy('reason')}
                >
                  <option value="">{t('reasonChoose')}</option>
                  {CONTENT_REPORT_REASONS.map((key) => (
                    <option key={key} value={key}>
                      {t(`reasons.${key}`)}
                    </option>
                  ))}
                </select>
                <FieldError id="report-reason-error" message={fieldError('reason')} />
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-description">
                  {t('description')} <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="report-description"
                  className="input content-report__textarea"
                  value={description}
                  maxLength={5000}
                  rows={6}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  required
                  aria-invalid={fieldError('description') ? true : undefined}
                  aria-describedby={describedBy('description')}
                />
                <FieldError id="report-description-error" message={fieldError('description')} />
              </div>

              <div className="content-report__row">
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="report-name">
                    {t('name')} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="report-name"
                    className="input"
                    autoComplete="name"
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                    required
                    aria-invalid={fieldError('name') ? true : undefined}
                    aria-describedby={describedBy('name')}
                  />
                  <FieldError id="report-name-error" message={fieldError('name')} />
                </div>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="report-email">
                    {t('email')} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="report-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    maxLength={255}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={fieldError('email') ? true : undefined}
                    aria-describedby={describedBy('email')}
                  />
                  <FieldError id="report-email-error" message={fieldError('email')} />
                </div>
              </div>

              {/* Für Menschen unsichtbar; Bots füllen es meist aus. */}
              <div className="content-report__trap" aria-hidden="true">
                <label htmlFor="report-website">Website</label>
                <input
                  id="report-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <label className="content-report__check">
                <input
                  id="report-good-faith"
                  type="checkbox"
                  checked={goodFaith}
                  onChange={(e) => setGoodFaith(e.target.checked)}
                  required
                  aria-invalid={fieldError('goodFaith') ? true : undefined}
                  aria-describedby={describedBy('goodFaith')}
                />
                <span>
                  {t('goodFaith')} <span aria-hidden="true">*</span>
                </span>
              </label>
              <FieldError id="report-goodFaith-error" message={fieldError('goodFaith')} />

              <p className="content-report__hint">
                {privacyUrl
                  ? t.rich('privacy', {
                      link: (chunks) => (
                        <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
                          {chunks}
                        </a>
                      ),
                    })
                  : t('privacyNoLink')}
              </p>

              {error && (
                <p className="content-report__error" role="alert">
                  {error}
                </p>
              )}

              {attempted && !valid && (
                <p className="public-field-error" role="alert">
                  {ta('fixFields')}
                </p>
              )}

              <button type="submit" className="btn btn--primary btn--block" disabled={pending} aria-busy={pending}>
                {pending ? t('sending') : t('submit')}
              </button>
            </form>
          )}

          {contactEmail && (
            <p className="content-report__contact" data-testid="content-report-contact">
              {t.rich('contact', {
                email: contactEmail,
                mail: (chunks) => <a href={`mailto:${contactEmail}`}>{chunks}</a>,
              })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

/** Fehlermeldung unter einem Feld (per aria-describedby verknüpft). */
function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p className="public-field-error" id={id}>
      {message}
    </p>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
