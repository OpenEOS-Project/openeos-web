'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tablet02, CheckCircle, XCircle, Loading02 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { useDeviceStore } from '@/stores/device-store';

type RegistrationStep = 'form' | 'pending' | 'verified' | 'blocked';

export default function DeviceRegisterPage() {
  const t = useTranslations('device');
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    deviceId,
    verificationCode,
    organizationName,
    status,
    isLoading,
    error,
    register,
    checkStatus,
    startPolling,
    stopPolling,
    clearDevice,
  } = useDeviceStore();

  // Pre-fill organization slug from URL parameter
  const orgFromUrl = searchParams.get('org') || '';
  const [name, setName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState(orgFromUrl);
  const [step, setStep] = useState<RegistrationStep>('form');

  // Determine step based on status
  useEffect(() => {
    if (status === 'verified') {
      setStep('verified');
      // Redirect to device POS after a short delay
      const timer = setTimeout(() => {
        router.push('/device/pos');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (status === 'blocked') {
      setStep('blocked');
    } else if (status === 'pending' && verificationCode) {
      setStep('pending');
    }
  }, [status, verificationCode, router]);

  // Start polling when on pending step
  useEffect(() => {
    if (step === 'pending') {
      startPolling();
    }
    return () => stopPolling();
  }, [step, startPolling, stopPolling]);

  // Check existing device status on mount
  useEffect(() => {
    if (deviceId && status) {
      checkStatus();
    }
  }, [deviceId, status, checkStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organizationSlug.trim()) return;

    try {
      await register(name.trim(), organizationSlug.trim());
      setStep('pending');
    } catch {
      // Error is set in store
    }
  };

  const handleReset = () => {
    clearDevice();
    setStep('form');
    setName('');
    setOrganizationSlug('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary">
            <Tablet02 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">{t('register.title')}</h1>
          <p className="mt-2 text-tertiary">{t('register.subtitle')}</p>
        </div>

        {/* Registration Form */}
        {step === 'form' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="organizationSlug">{t('register.organizationSlug')}</Label>
                <Input
                  id="organizationSlug"
                  value={organizationSlug}
                  onChange={setOrganizationSlug}
                  placeholder={t('register.organizationSlugPlaceholder')}
                  autoComplete="off"
                />
                <p className="text-xs text-tertiary">{t('register.organizationSlugHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">{t('register.deviceName')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={setName}
                  placeholder={t('register.deviceNamePlaceholder')}
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !name.trim() || !organizationSlug.trim()}
              >
                {isLoading ? t('register.registering') : t('register.submit')}
              </Button>
            </form>
          </div>
        )}

        {/* Pending Verification */}
        {step === 'pending' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-secondary">
                <Loading02 className="h-6 w-6 text-warning-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-primary">{t('register.pendingTitle')}</h2>
              <p className="mt-2 text-tertiary">{t('register.pendingDescription')}</p>
            </div>

            {organizationName && (
              <p className="mb-4 text-sm text-secondary">
                {t('register.organization')}: <strong>{organizationName}</strong>
              </p>
            )}

            {/* Verification Code Display */}
            <div className="mb-6 rounded-xl bg-secondary p-6">
              <p className="mb-2 text-sm font-medium text-tertiary">{t('register.verificationCode')}</p>
              <div className="text-5xl font-bold tracking-widest text-brand-primary">
                {verificationCode}
              </div>
            </div>

            <p className="mb-6 text-sm text-tertiary">{t('register.pendingHint')}</p>

            <Button color="secondary" onClick={handleReset} className="w-full">
              {t('register.cancel')}
            </Button>
          </div>
        )}

        {/* Verified */}
        {step === 'verified' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
              <CheckCircle className="h-6 w-6 text-success-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('register.verifiedTitle')}</h2>
            <p className="mt-2 text-tertiary">{t('register.verifiedDescription')}</p>
            <p className="mt-4 text-sm text-secondary">{t('register.redirecting')}</p>
          </div>
        )}

        {/* Blocked */}
        {step === 'blocked' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
              <XCircle className="h-6 w-6 text-error-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('register.blockedTitle')}</h2>
            <p className="mt-2 text-tertiary">{t('register.blockedDescription')}</p>

            <Button color="secondary" onClick={handleReset} className="mt-6 w-full">
              {t('register.tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
