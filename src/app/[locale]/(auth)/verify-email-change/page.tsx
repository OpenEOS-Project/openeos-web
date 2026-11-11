'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleCheck, RefreshCw, X } from 'lucide-react';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { Button } from '@/components/ui/buttons/button';
import { userSettingsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

type Status = 'loading' | 'success' | 'error';

/**
 * Neue E-Mail-Adresse bestätigen (Link aus der Mail an die neue Adresse).
 *
 * Geht ohne Anmeldung — der Link wird oft auf dem Handy geöffnet. Ist im
 * selben Browser jemand angemeldet, übernimmt die Oberfläche die neue
 * Adresse gleich in die Sitzung.
 */
export default function VerifyEmailChangePage() {
  const t = useTranslations('auth.verifyEmailChange');
  const apiErrorMessage = useApiErrorMessage();
  const token = useSearchParams().get('token');
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  // Der Token gilt einmal: StrictMode ruft den Effekt doppelt auf.
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
        const response = await userSettingsApi.verifyEmailChange(token);
        const updated = response.data;
        setEmail(updated?.email ?? null);
        const current = useAuthStore.getState().user;
        if (current && updated && current.id === updated.id) {
          setUser({ ...current, email: updated.email, pendingEmail: null });
        }
        setStatus('success');
      } catch (err) {
        setError(apiErrorMessage(err, t('error')));
        setStatus('error');
      }
    })();
  }, [token, t, apiErrorMessage, setUser]);

  if (status === 'loading') {
    return (
      <div className="text-center">
        <RefreshCw className="mx-auto mb-6 h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm text-tertiary">{t('loading')}</p>
      </div>
    );
  }

  const next = user ? { href: '/settings?tab=account', label: t('toSettings') } : { href: '/login', label: t('toLogin') };

  if (status === 'success') {
    return (
      <>
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
            <CircleCheck className="h-6 w-6 text-success-primary" />
          </div>
        </div>
        <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('successTitle')}</h1>
        <p className="mb-6 text-center text-sm text-tertiary" data-testid="email-change-success">
          {email ? t('successMessage', { email }) : t('successMessageNoEmail')}
        </p>
        <Link href={next.href}>
          <Button className="w-full">{next.label}</Button>
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
      <Link href={next.href}>
        <Button className="w-full" color="secondary">
          {next.label}
        </Button>
      </Link>
    </>
  );
}
