'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Building07, User01, Globe01, Home01 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { useSetup } from '@/components/providers/setup-provider';
import { setupApi } from '@/lib/api-client';
import type { SetupMode } from '@/types/setup';

type SetupStep = 'mode' | 'form' | 'complete';

const baseFields = {
  email: z.string().email(),
  password: z.string().min(8),
  passwordConfirm: z.string(),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
};

const passwordMatchRefinement = (data: { password: string; passwordConfirm: string }) =>
  data.password === data.passwordConfirm;

const singleModeSchema = z.object({
  ...baseFields,
  organizationName: z.string().min(2).max(200),
}).refine(passwordMatchRefinement, {
  message: "Passwords don't match",
  path: ['passwordConfirm'],
});

const multiModeSchema = z.object(baseFields).refine(passwordMatchRefinement, {
  message: "Passwords don't match",
  path: ['passwordConfirm'],
});

type SingleModeFormData = z.infer<typeof singleModeSchema>;
type MultiModeFormData = z.infer<typeof multiModeSchema>;

export default function SetupPage() {
  const t = useTranslations('setup');
  const router = useRouter();
  const { setupStatus, refetch } = useSetup();

  const [step, setStep] = useState<SetupStep>('mode');
  const [mode, setMode] = useState<SetupMode>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if setup is not required
  useEffect(() => {
    if (setupStatus && !setupStatus.required) {
      router.replace('/login');
    }
  }, [setupStatus, router]);

  const singleForm = useForm<SingleModeFormData>({
    resolver: zodResolver(singleModeSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      firstName: '',
      lastName: '',
      organizationName: '',
    },
  });

  const multiForm = useForm<MultiModeFormData>({
    resolver: zodResolver(multiModeSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      firstName: '',
      lastName: '',
    },
  });

  const handleModeSelect = (selectedMode: SetupMode) => {
    setMode(selectedMode);
    setStep('form');
  };

  const onSubmit = async (data: SingleModeFormData | MultiModeFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'single') {
        const singleData = data as SingleModeFormData;
        await setupApi.complete({
          mode: 'single',
          email: singleData.email,
          password: singleData.password,
          firstName: singleData.firstName,
          lastName: singleData.lastName,
          organizationName: singleData.organizationName,
        });
      } else {
        await setupApi.complete({
          mode: 'multi',
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      }

      // Refetch setup status
      await refetch();

      // Show success and redirect to login
      setStep('complete');
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
  if (step === 'complete') {
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

        {/* Mode Selection */}
        {step === 'mode' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
              <p className="mt-2 text-tertiary">{t('modeSelect.description')}</p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleModeSelect('single')}
                className="w-full flex items-start gap-4 p-4 rounded-lg border border-secondary hover:border-brand-primary hover:bg-brand-secondary/5 transition-colors text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
                  <Home01 className="h-5 w-5 text-brand-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary">{t('modeSelect.single.title')}</p>
                  <p className="text-sm text-tertiary mt-1">{t('modeSelect.single.description')}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect('multi')}
                className="w-full flex items-start gap-4 p-4 rounded-lg border border-secondary hover:border-brand-primary hover:bg-brand-secondary/5 transition-colors text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
                  <Globe01 className="h-5 w-5 text-brand-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary">{t('modeSelect.multi.title')}</p>
                  <p className="text-sm text-tertiary mt-1">{t('modeSelect.multi.description')}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Single Mode Form */}
        {step === 'form' && mode === 'single' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
            <form onSubmit={singleForm.handleSubmit(onSubmit)} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-secondary">
                  <Home01 className="h-6 w-6 text-brand-primary" />
                </div>
                <h1 className="text-xl font-bold text-primary">{t('modeSelect.single.title')}</h1>
                <p className="mt-1 text-sm text-tertiary">{t('form.single.subtitle')}</p>
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
                    control={singleForm.control}
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
                    control={singleForm.control}
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
                  control={singleForm.control}
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
                  control={singleForm.control}
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
                  control={singleForm.control}
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
                  control={singleForm.control}
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  color="secondary"
                  onClick={() => setStep('mode')}
                  className="flex-1"
                >
                  {t('form.back')}
                </Button>
                <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                  {t('submit')}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Multi Mode Form */}
        {step === 'form' && mode === 'multi' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
            <form onSubmit={multiForm.handleSubmit(onSubmit)} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-warning-secondary">
                  <Globe01 className="h-6 w-6 text-warning-primary" />
                </div>
                <h1 className="text-xl font-bold text-primary">{t('modeSelect.multi.title')}</h1>
                <p className="mt-1 text-sm text-tertiary">{t('form.multi.subtitle')}</p>
              </div>

              {error && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {error}
                </div>
              )}

              {/* Super Admin Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                  <User01 className="h-4 w-4" />
                  {t('admin.superAdminTitle')}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="firstName"
                    control={multiForm.control}
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
                    control={multiForm.control}
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
                  control={multiForm.control}
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
                  control={multiForm.control}
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
                  control={multiForm.control}
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  color="secondary"
                  onClick={() => setStep('mode')}
                  className="flex-1"
                >
                  {t('form.back')}
                </Button>
                <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                  {t('submit')}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
