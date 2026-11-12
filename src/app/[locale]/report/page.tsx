'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
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

  const valid =
    isHttpUrl(url) &&
    !!reason &&
    description.trim().length >= 20 &&
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    goodFaith;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !reason) {
      setError(t('incomplete'));
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
              <h1>{t('sentTitle')}</h1>
              <p>{t('sentText')}</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="content-report__title">
                <Flag aria-hidden="true" />
                <h1>{t('title')}</h1>
              </div>
              <p className="content-report__intro">{t('intro')}</p>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-url">
                  {t('url')} *
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
                />
                <p className="content-report__hint">{t('urlHint')}</p>
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-reason">
                  {t('reason')} *
                </label>
                <select
                  id="report-reason"
                  className="select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ContentReportReason)}
                  required
                >
                  <option value="">{t('reasonChoose')}</option>
                  {CONTENT_REPORT_REASONS.map((key) => (
                    <option key={key} value={key}>
                      {t(`reasons.${key}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-field">
                <label className="auth-field__label" htmlFor="report-description">
                  {t('description')} *
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
                />
              </div>

              <div className="content-report__row">
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="report-name">
                    {t('name')} *
                  </label>
                  <input
                    id="report-name"
                    className="input"
                    autoComplete="name"
                    value={name}
                    maxLength={200}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="report-email">
                    {t('email')} *
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
                  />
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
                <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
                <span>{t('goodFaith')}</span>
              </label>

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

              <button type="submit" className="btn btn--primary btn--block" disabled={pending || !valid}>
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

export default function ReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
