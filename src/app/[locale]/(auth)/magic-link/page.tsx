'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RefreshCw01, X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { apiClient, authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';

type Status = 'loading' | 'error';

/**
 * Löst den Anmeldelink ein und leitet weiter.
 *
 * Es gibt bewusst keinen Erfolgszustand mit Knopf: wer hier ankommt, will
 * ins Dashboard und nicht bestätigt bekommen, dass er gleich darf.
 */
export default function MagicLinkPage() {
  const t = useTranslations('auth.magicLinkPage');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const { setUser, setOrganizations } = useAuthStore();

  /* Der Token wird serverseitig beim ersten Zugriff verbraucht. Ohne
     diese Sperre löste React im Entwicklungsmodus zweimal aus — der
     zweite Aufruf liefe ins Leere und meldete "ungültig", obwohl die
     Anmeldung gerade geklappt hat. */
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
        const response = await authApi.verifyMagicLink(token);
        const daten = response.data;

        if ('accessToken' in daten) {
          apiClient.setAccessToken(daten.accessToken);
          setUser(daten.user);
          setOrganizations(daten.user.userOrganizations || []);
          // Harter Wechsel wie beim Passwort-Login, damit der Server die
          // Sitzung aus den Cookies sieht.
          window.location.href = decodeURIComponent(redirectUrl);
          return;
        }

        setError(t('error'));
        setStatus('error');
      } catch (err) {
        setError(err instanceof ApiException ? err.message : t('error'));
        setStatus('error');
      }
    })();
  }, [token, t, redirectUrl, setUser, setOrganizations]);

  if (status === 'loading') {
    return (
      <div className="text-center">
        <RefreshCw01 className="mx-auto mb-6 h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm text-tertiary">{t('loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-center">
        <div className="bg-error-secondary flex h-12 w-12 items-center justify-center rounded-full">
          <X className="text-error-primary h-6 w-6" />
        </div>
      </div>

      <h1 className="mb-2 text-center text-2xl font-semibold text-primary">{t('errorTitle')}</h1>
      <p className="mb-6 text-center text-sm text-tertiary">{error}</p>

      <Link href="/login">
        <Button className="w-full">{t('backToLogin')}</Button>
      </Link>
    </>
  );
}
