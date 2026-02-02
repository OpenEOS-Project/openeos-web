'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle, Lock01 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { FormInput } from '@/components/ui/input/form-input';
import { authApi } from '@/lib/api-client';
import { ApiException } from '@/types/api';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError(t('invalidToken'));
      return;
    }

    setError(null);
    try {
      await authApi.resetPassword(token, data.password);
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError(t('error'));
      }
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary px-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-secondary bg-primary p-8 shadow-lg">
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
                <Lock01 className="h-6 w-6 text-error-primary" />
              </div>
            </div>

            <h1 className="mb-2 text-center text-2xl font-semibold text-primary">
              {t('invalidTokenTitle')}
            </h1>
            <p className="mb-6 text-center text-sm text-tertiary">
              {t('invalidTokenMessage')}
            </p>

            <Link href="/forgot-password">
              <Button className="w-full">{t('requestNewLink')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary px-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-secondary bg-primary p-8 shadow-lg">
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
                <CheckCircle className="h-6 w-6 text-success-primary" />
              </div>
            </div>

            <h1 className="mb-2 text-center text-2xl font-semibold text-primary">
              {t('successTitle')}
            </h1>
            <p className="mb-6 text-center text-sm text-tertiary">
              {t('successMessage')}
            </p>

            <Link href="/login">
              <Button className="w-full">{t('backToLogin')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-secondary bg-primary p-8 shadow-lg">
          <div className="mb-6">
            <h1 className="mb-2 text-2xl font-semibold text-primary">{t('title')}</h1>
            <p className="text-sm text-tertiary">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label={t('password')}
              type="password"
              placeholder="********"
              isInvalid={!!errors.password}
              hint={errors.password?.message || t('passwordHint')}
              {...register('password')}
            />

            <FormInput
              label={t('confirmPassword')}
              type="password"
              placeholder="********"
              isInvalid={!!errors.confirmPassword}
              hint={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {error && (
              <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              {t('submit')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-tertiary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
