'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail01 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { authApi } from '@/lib/api-client';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const tCommon = useTranslations('common');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    try {
      await authApi.forgotPassword(data.email);
      setIsSubmitted(true);
    } catch {
      // Always show success to prevent email enumeration
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary px-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-secondary bg-primary p-8 shadow-lg">
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
                <Mail01 className="h-6 w-6 text-success-primary" />
              </div>
            </div>

            <h1 className="mb-2 text-center text-2xl font-semibold text-primary">
              {t('successTitle')}
            </h1>
            <p className="mb-6 text-center text-sm text-tertiary">
              {t('successMessage')}
            </p>

            <Link href="/login">
              <Button className="w-full" color="secondary" iconLeading={ArrowLeft}>
                {t('backToLogin')}
              </Button>
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
            <Input
              label={t('email')}
              type="email"
              placeholder="name@example.com"
              isInvalid={!!errors.email}
              hint={errors.email?.message}
              {...register('email')}
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
