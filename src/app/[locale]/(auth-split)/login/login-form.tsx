'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Tablet02 } from '@untitledui/icons';

import { Link } from '@/i18n/routing';
import { apiClient, authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import { isTwoFactorRequired } from '@/types/auth';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login({ email, password });

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

      <form className="auth-form__body" onSubmit={onSubmit} noValidate>
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
      </form>

      <p className="auth-form__alt">
        {t('noAccount')}{' '}
        <Link href="/register" className="auth-form__alt-link">
          {t('register')} →
        </Link>
      </p>

      <Link href="/device/register" className="auth-form__device">
        <Tablet02 />
        <span>{t('deviceMode')}</span>
      </Link>
    </div>
  );
}
