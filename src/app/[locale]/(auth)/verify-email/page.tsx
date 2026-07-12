'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, RefreshCw01, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { authApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  // The token is consumed server-side on first use — guard against React
  // StrictMode's double effect invocation, which would burn it twice and
  // surface a bogus "invalid link" error after a successful verification.
  const requestedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t('missingToken'));
      setStatus('error');
      return;
    }
    if (requestedToken.current === token) return;
    requestedToken.current = token;

    (async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setError(err instanceof ApiException ? err.message : t('error'));
        setStatus('error');
      }
    })();
  }, [token, t]);

  if (status === 'loading') {
    return (
      <div className="text-center">
        <RefreshCw01 className="mx-auto mb-6 h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm text-tertiary">{t('loading')}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <>
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
            <CheckCircle className="h-6 w-6 text-success-primary" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold text-primary">
          {t('successTitle')}
        </h1>
        <p className="mb-6 text-center text-sm text-tertiary">{t('successMessage')}</p>

        <Link href="/login">
          <Button className="w-full">{t('backToLogin')}</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
          <X className="h-6 w-6 text-error-primary" />
        </div>
      </div>

      <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('errorTitle')}</h1>
      <p className="mb-2 text-center text-sm text-tertiary">{error}</p>
      <p className="mb-6 text-center text-sm text-tertiary">{t('errorHint')}</p>

      <Link href="/login">
        <Button className="w-full" color="secondary">
          {t('backToLogin')}
        </Button>
      </Link>
    </>
  );
}
