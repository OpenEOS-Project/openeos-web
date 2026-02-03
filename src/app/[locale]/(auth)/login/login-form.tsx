'use client';

import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Mail01, Tablet02 } from '@untitledui/icons';
import { z } from 'zod';

import { Button } from '@/components/ui/buttons/button';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Input } from '@/components/ui/input/input';
import { Link } from '@/i18n/routing';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import { isTwoFactorRequired } from '@/types/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const { setUser, setOrganizations, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  // Get redirect URL from query params (set by AuthGuard)
  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(decodeURIComponent(redirectUrl));
    }
  }, [isAuthLoading, isAuthenticated, router, redirectUrl]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
      });

      // Check if 2FA is required
      if (isTwoFactorRequired(response.data)) {
        // Redirect to 2FA verification page
        const params = new URLSearchParams({
          token: response.data.twoFactorToken,
          method: response.data.twoFactorMethod,
        });
        router.push(`/2fa-verify?${params.toString()}`);
        return;
      }

      // Store auth data
      apiClient.setAccessToken(response.data.accessToken);
      setUser(response.data.user);
      setOrganizations(response.data.user.userOrganizations || []);

      // Redirect to original destination or dashboard
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
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600 ring-1 ring-error-200 ring-inset dark:bg-error-950 dark:text-error-400 dark:ring-error-800">
          {error}
        </div>
      )}

      {/* Email Input */}
      <Controller
        name="email"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Input
            type="email"
            label={t('email')}
            placeholder={t('emailPlaceholder')}
            icon={Mail01}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.email}
            hint={errors.email ? t('errors.emailRequired') : undefined}
            autoComplete="email"
          />
        )}
      />

      {/* Password Input */}
      <Controller
        name="password"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Input
            type="password"
            label={t('password')}
            placeholder={t('passwordPlaceholder')}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.password}
            hint={errors.password ? t('errors.passwordRequired') : undefined}
            autoComplete="current-password"
          />
        )}
      />

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <Checkbox isSelected={rememberMe} onChange={setRememberMe} label={t('rememberMe')} />

        <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          {t('forgotPassword')}
        </Link>
      </div>

      {/* Submit Button */}
      <Button type="submit" color="primary" size="md" isLoading={isLoading} className="w-full">
        {t('submit')}
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-secondary" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-primary px-2 text-tertiary">{t('noAccount')}</span>
        </div>
      </div>

      {/* Register Link */}
      <Button href="/register" color="secondary" size="md" className="w-full">
        {t('register')}
      </Button>

      {/* Device Mode Link */}
      <div className="pt-4">
        <Link
          href="/device/register"
          className="flex items-center justify-center gap-2 text-sm text-tertiary hover:text-secondary"
        >
          <Tablet02 className="h-4 w-4" />
          {t('deviceMode')}
        </Link>
      </div>
    </form>
  );
}
