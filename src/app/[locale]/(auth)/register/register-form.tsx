'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail01, User01, Building07, Lock01 } from '@untitledui/icons';
import { z } from 'zod';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Link } from '@/i18n/routing';
import { apiClient, authApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  organizationName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setUser, setOrganizations } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        organizationName: data.organizationName || undefined,
      });

      // Store auth data
      apiClient.setAccessToken(response.data.accessToken);
      setUser(response.data.user);
      setOrganizations(response.data.user.userOrganizations || []);

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      if (err instanceof ApiException) {
        switch (err.code) {
          case 'EMAIL_ALREADY_EXISTS':
          case 'CONFLICT':
            setError(t('errors.emailTaken'));
            break;
          default:
            setError(err.message);
        }
      } else {
        setError('Ein Fehler ist aufgetreten');
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

      {/* Name Row */}
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="firstName"
          control={control}
          render={({ field }) => (
            <Input
              label={t('firstName')}
              placeholder="Max"
              icon={User01}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              isInvalid={!!errors.firstName}
              autoComplete="given-name"
            />
          )}
        />

        <Controller
          name="lastName"
          control={control}
          render={({ field }) => (
            <Input
              label={t('lastName')}
              placeholder="Mustermann"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              isInvalid={!!errors.lastName}
              autoComplete="family-name"
            />
          )}
        />
      </div>

      {/* Email Input */}
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <Input
            type="email"
            label={t('email')}
            placeholder="max@beispiel.de"
            icon={Mail01}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.email}
            hint={errors.email?.message}
            autoComplete="email"
          />
        )}
      />

      {/* Password Input */}
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <Input
            type="password"
            label={t('password')}
            placeholder="Mindestens 8 Zeichen"
            icon={Lock01}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.password}
            hint={errors.password?.message}
            autoComplete="new-password"
          />
        )}
      />

      {/* Confirm Password Input */}
      <Controller
        name="confirmPassword"
        control={control}
        render={({ field }) => (
          <Input
            type="password"
            label={t('confirmPassword')}
            placeholder="Passwort wiederholen"
            icon={Lock01}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.confirmPassword}
            hint={errors.confirmPassword?.message}
            autoComplete="new-password"
          />
        )}
      />

      {/* Organization Name (Optional) */}
      <Controller
        name="organizationName"
        control={control}
        render={({ field }) => (
          <Input
            label={t('organization')}
            placeholder="Mein Verein e.V. (optional)"
            icon={Building07}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            hint="Optional - Du kannst auch spaeter eine Organisation erstellen"
          />
        )}
      />

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
          <span className="bg-primary px-2 text-tertiary">{t('hasAccount')}</span>
        </div>
      </div>

      {/* Login Link */}
      <Button href="/login" color="secondary" size="md" className="w-full">
        {t('login')}
      </Button>
    </form>
  );
}
