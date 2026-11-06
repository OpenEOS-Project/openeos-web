'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleCheck, MailX, RefreshCw, X } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { Button } from '@/components/ui/buttons/button';
import { privacyApi } from '@/lib/api-client';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Abmeldelink aus Newsletter-Mails (Datenschutzerklärung 13.3). Abgemeldet
 * wird erst mit dem Klick – Linkprüfer in Mailservern rufen Links auf und
 * sollen niemanden abmelden. Mailprogramme mit „One-Click“ (RFC 8058)
 * schicken direkt einen POST an die API.
 */
export default function NewsletterUnsubscribePage() {
  const t = useTranslations('privacy.unsubscribe');
  const apiErrorMessage = useApiErrorMessage();
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error');
  const [error, setError] = useState<string | null>(token ? null : t('missingToken'));

  const unsubscribe = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      await privacyApi.unsubscribeNewsletter(token);
      setStatus('success');
    } catch (err) {
      setError(apiErrorMessage(err, t('error')));
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div data-testid="unsubscribe-success">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
            <CircleCheck className="h-6 w-6 text-success-primary" />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('successTitle')}</h1>
        <p className="mb-6 text-center text-sm text-tertiary">{t('successMessage')}</p>
        <Link href="/login">
          <Button className="w-full" color="secondary">
            {t('toLogin')}
          </Button>
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div data-testid="unsubscribe-error">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
            <X className="h-6 w-6 text-error-primary" />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('errorTitle')}</h1>
        <p className="mb-2 text-center text-sm text-tertiary">{error}</p>
        <p className="mb-6 text-center text-sm text-tertiary">{t('errorHint')}</p>
      </div>
    );
  }

  return (
    <div data-testid="unsubscribe-confirm">
      <div className="mb-6 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary">
          <MailX className="h-6 w-6 text-brand-primary" />
        </div>
      </div>
      <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('title')}</h1>
      <p className="mb-6 text-center text-sm text-tertiary">{t('text')}</p>
      <Button className="w-full" onClick={unsubscribe} isDisabled={status === 'loading'}>
        {status === 'loading' ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('confirm')}
      </Button>
    </div>
  );
}
