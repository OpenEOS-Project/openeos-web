'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Building07, User01 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { useSetup } from '@/components/providers/setup-provider';
import { setupApi } from '@/lib/api-client';

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  passwordConfirm: z.string(),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  organizationName: z.string().min(2).max(200),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords don't match",
  path: ['passwordConfirm'],
});

type SetupFormData = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const { setupStatus, refetch } = useSetup();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if setup is not required
  useEffect(() => {
    if (setupStatus && !setupStatus.required) {
      router.replace('/login');
    }
  }, [setupStatus, router]);

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      firstName: '',
      lastName: '',
      organizationName: '',
    },
  });

  const onSubmit = async (data: SetupFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await setupApi.complete({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        organizationName: data.organizationName,
      });

      // Refetch setup status
      await refetch();

      // Show success and redirect to login
      setIsComplete(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.setupFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success screen
  if (isComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo_dark.png"
              alt="OpenEOS"
              width={180}
              height={48}
              className="dark:hidden"
            />
            <Image
              src="/logo_light.png"
              alt="OpenEOS"
              width={180}
              height={48}
              className="hidden dark:block"
            />
          </div>

          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-secondary">
              <CheckCircle className="h-8 w-8 text-success-primary" />
            </div>
            <h1 className="text-2xl font-bold text-primary">{t('complete.title')}</h1>
            <p className="mt-2 text-tertiary">{t('complete.description')}</p>
            <div className="mt-6 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo_dark.png"
            alt="OpenEOS"
            width={180}
            height={48}
            className="dark:hidden"
          />
          <Image
            src="/logo_light.png"
            alt="OpenEOS"
            width={180}
            height={48}
            className="hidden dark:block"
          />
        </div>

        {/* Card */}
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
              <p className="mt-2 text-tertiary">{t('description')}</p>
            </div>

            {error && (
              <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                {error}
              </div>
            )}

            {/* Admin Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                <User01 className="h-4 w-4" />
                {t('admin.sectionTitle')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="firstName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Input
                      label={t('admin.firstName')}
                      value={field.value}
                      onChange={field.onChange}
                      isInvalid={!!fieldState.error}
                      hint={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="lastName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Input
                      label={t('admin.lastName')}
                      value={field.value}
                      onChange={field.onChange}
                      isInvalid={!!fieldState.error}
                      hint={fieldState.error?.message}
                    />
                  )}
                />
              </div>

              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    type="email"
                    label={t('admin.email')}
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!fieldState.error}
                    hint={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    type="password"
                    label={t('admin.password')}
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!fieldState.error}
                    hint={fieldState.error?.message || t('admin.passwordHint')}
                  />
                )}
              />

              <Controller
                name="passwordConfirm"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    type="password"
                    label={t('admin.passwordConfirm')}
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!fieldState.error}
                    hint={fieldState.error?.message}
                  />
                )}
              />
            </div>

            {/* Organization Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                <Building07 className="h-4 w-4" />
                {t('organization.sectionTitle')}
              </div>

              <Controller
                name="organizationName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    label={t('organization.name')}
                    placeholder={t('organization.namePlaceholder')}
                    value={field.value}
                    onChange={field.onChange}
                    isInvalid={!!fieldState.error}
                    hint={fieldState.error?.message}
                  />
                )}
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              {t('submit')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
