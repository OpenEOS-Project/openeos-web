'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Tablet02, Tv01 } from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { apiClient, authApi } from '@/lib/api-client';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import { isTwoFactorRequired } from '@/types/auth';
import { useDeployment } from '@/components/providers/setup-provider';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  /* Zwei Wege ins Konto. Der Link steht vorn: er verlangt nichts, was man
     vergessen haben kann. Das Passwort bleibt einen Klick entfernt, denn
     jedes bestehende Konto hat eines. */
  /* Ohne Mailversand kommt der Anmeldelink nie an, und eigenstaendig ist
     ein Mailserver nicht vorausgesetzt. Dort startet die Maske deshalb
     beim Passwort. */
  const deployment = useDeployment();
  const [modus, setModus] = useState<'password' | 'link'>(
    deployment.multiTenant ? 'link' : 'password',
  );
  const [linkStatus, setLinkStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const {
    setUser,
    setOrganizations,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthStore();

  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const prefillEmail = searchParams.get('email') || '';

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(decodeURIComponent(redirectUrl));
    }
  }, [isAuthLoading, isAuthenticated, router, redirectUrl]);

  async function handleResend() {
    setResendStatus('sending');
    try {
      await authApi.resendVerification(email);
    } finally {
      setResendStatus('sent');
    }
  }

  async function onSubmitLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLinkStatus('sending');
    setError(null);
    try {
      await authApi.requestMagicLink(email);
    } finally {
      /* Auch bei einem Fehler "gesendet" melden: der Server antwortet
         bewusst gleich, egal ob es das Konto gibt. Eine abweichende
         Anzeige hier machte die Auskunft wieder auf. */
      setLinkStatus('sent');
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailNotVerified(false);
    setResendStatus('idle');

    try {
      /* Der Fingerabdruck entscheidet, ob dieses Gerät als vertraut gilt
         und der zweite Faktor entfallen darf. Ohne ihn fragte die
         Anmeldung auch auf dem eigenen Rechner jedes Mal nach. */
      const response = await authApi.login({
        email,
        password,
        deviceFingerprint: getDeviceFingerprint(),
      });

      if (isTwoFactorRequired(response.data)) {
        const params = new URLSearchParams({
          token: response.data.twoFactorToken,
          method: response.data.twoFactorMethod,
        });
        router.push(`/2fa-verify?${params.toString()}`);
        return;
      }

      apiClient.setAccessToken(response.data.accessToken);
      setUser(response.data.user);
      setOrganizations(response.data.user.userOrganizations || []);

      window.location.href = decodeURIComponent(redirectUrl);
    } catch (err) {
      if (err instanceof ApiException) {
        switch (err.code) {
          case 'INVALID_CREDENTIALS':
            setError(t('errors.invalidCredentials'));
            break;
          case 'ACCOUNT_LOCKED':
            setError(t('errors.accountLocked'));
            break;
          case 'EMAIL_NOT_VERIFIED':
            setError(t('errors.emailNotVerified'));
            setEmailNotVerified(true);
            break;
          default:
            setError(err.message);
        }
      } else {
        setError(t('errors.invalidCredentials'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  const titleParts = t('title').split(' ');
  const titleHead = titleParts.slice(0, -1).join(' ');
  const titleTail = titleParts.slice(-1)[0];

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">
        <span>{titleHead}</span> <span className="u-accent">{titleTail}</span>
      </h1>
      <p className="auth-form__sub">{t('subtitle')}</p>

      {error && <div className="auth-form__error">{error}</div>}
      {emailNotVerified && (
        <div className="auth-form__resend">
          {resendStatus === 'sent' ? (
            <span className="auth-hint">{t('resendVerificationSent')}</span>
          ) : (
            <button
              type="button"
              className="auth-form__forgot auth-form__link-btn"
              onClick={handleResend}
              disabled={resendStatus === 'sending'}
            >
              {resendStatus === 'sending' ? '…' : t('resendVerification')}
            </button>
          )}
        </div>
      )}

      {/* Die Schlüssel an den beiden Formularen trennen sie für React.
          Ohne sie stehen beide an derselben Stelle im Baum, und React
          verwendet dieselben DOM-Knoten weiter: Beim Umschalten wurde aus
          dem gerade angeklickten `type="button"` ein `type="submit"`,
          woraufhin der Browser das Formular mit leeren Feldern abschickte
          und ein „Unauthorized" erschien. */}
      {modus === 'link' ? (
        <form key="anmeldung-link" className="auth-form__body" onSubmit={onSubmitLink} noValidate>
          <label className="auth-field">
            <span>{t('email')}</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLinkStatus('idle');
              }}
            />
          </label>

          {linkStatus === 'sent' ? (
            <p className="auth-hint">{t('magicLink.sent')}</p>
          ) : (
            <p className="auth-hint">{t('magicLink.explain')}</p>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--block btn--lg"
            disabled={linkStatus === 'sending' || !email}
          >
            <span>{linkStatus === 'sending' ? '…' : t('magicLink.submit')}</span>
            <ArrowRight />
          </button>

          <button
            type="button"
            className="auth-form__forgot auth-form__link-btn"
            onClick={() => {
              setModus('password');
              setLinkStatus('idle');
            }}
          >
            {t('magicLink.usePassword')}
          </button>
        </form>
      ) : (
      <form key="anmeldung-passwort" className="auth-form__body" onSubmit={onSubmit} noValidate>
        <label className="auth-field">
          <span>{t('email')}</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>{t('password')}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div className="auth-form__row">
          <label className="auth-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>{t('rememberMe')}</span>
          </label>
          <Link href="/forgot-password" className="auth-form__forgot">
            {t('forgotPassword')}
          </Link>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--block btn--lg"
          disabled={isLoading}
        >
          <span>{isLoading ? '…' : t('submit')}</span>
          <ArrowRight />
        </button>

        <button
          type="button"
          className="auth-form__forgot auth-form__link-btn"
          onClick={() => {
            setModus('link');
            setError(null);
          }}
        >
          {t('magicLink.useLink')}
        </button>
      </form>
      )}

      {/* Eigenstaendig ist die Selbstregistrierung abgeschaltet (die API
          antwortet mit 403) — Konten legt die Mitgliederverwaltung an. Der
          Hinweis fuehrte sonst auf eine Seite, die nur absagen kann. */}
      {deployment.multiTenant && (
        <p className="auth-form__alt">
          {t('noAccount')}{' '}
          <Link href="/register" className="auth-form__alt-link">
            {t('register')} →
          </Link>
        </p>
      )}

      <div className="auth-form__devices">
        {/* Beide Wege führen zur Kopplung per Code: das Gerät zeigt eine
            Zahl, verknüpft wird sie in einem angemeldeten Konto. Der Typ
            entscheidet nur, wohin es danach geht. */}
        <Link href="/device/pair?type=pos" className="auth-form__device">
          <Tablet02 />
          <span>{t('deviceMode')}</span>
        </Link>
        <Link href="/device/pair?type=display" className="auth-form__device">
          <Tv01 />
          <span>{t('displayMode')}</span>
        </Link>
      </div>
    </div>
  );
}
