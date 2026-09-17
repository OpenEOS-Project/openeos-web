'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { CheckCircle, AlertCircle, Tv01, Loading02 } from '@untitledui/icons';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi, organizationsApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';

type Step = 'enter-code' | 'configure' | 'success' | 'error';

const DEVICE_TYPE_VALUES: DeviceClass[] = ['display', 'pos', 'admin'];

export default function DeviceVerifyPage() {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organizations } = useAuthStore();

  const codeFromUrl = searchParams.get('code') || '';

  const [step, setStep] = useState<Step>(codeFromUrl ? 'enter-code' : 'enter-code');
  const [code, setCode] = useState(codeFromUrl);
  const [pendingDevice, setPendingDevice] = useState<PendingDeviceLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state for configuration
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceClass>('display');

  // Set default organization if user only has one
  useEffect(() => {
    if (organizations && organizations.length === 1) {
      setSelectedOrgId(organizations[0].organizationId);
    }
  }, [organizations]);

  // Lookup device when code from URL is present
  useEffect(() => {
    if (codeFromUrl && codeFromUrl.length === 6) {
      handleLookup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  // Lookup mutation
  const lookupMutation = useMutation({
    mutationFn: (lookupCode: string) => devicesApi.lookup(lookupCode),
    onSuccess: (response) => {
      const device = response.data;
      setPendingDevice(device);
      setDeviceName(device.suggestedName || 'TV Display');
      setDeviceType(device.deviceType || 'display');
      setStep('configure');
      setError(null);
    },
    onError: () => {
      setError(t('verify.deviceNotFound'));
    },
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: () => devicesApi.link({
      code,
      organizationId: selectedOrgId,
      name: deviceName,
      deviceType,
    }),
    onSuccess: () => {
      setStep('success');
    },
    onError: () => {
      setError(t('verify.linkFailed'));
    },
  });

  const handleLookup = () => {
    if (code.length !== 6) {
      setError(t('verify.invalidCode'));
      return;
    }
    setError(null);
    lookupMutation.mutate(code);
  };

  const handleLink = () => {
    if (!selectedOrgId) {
      setError(t('verify.selectOrganization'));
      return;
    }
    if (!deviceName.trim()) {
      setError(t('verify.enterName'));
      return;
    }
    setError(null);
    linkMutation.mutate();
  };

  const handleGoToDashboard = () => {
    router.push('/devices');
  };

  // If not logged in, show login prompt
  if (!user) {
    return (
      <div className="landing verify-page">
        <div className="app-card verify-card verify-card--center">
          <div className="verify-card__icon">
            <Tv01 />
          </div>
          <h1 className="text-2xl font-bold text-primary">{t('verify.title')}</h1>
          <p className="mt-2 text-tertiary">{t('verify.loginRequired')}</p>
          <button type="button" className="btn btn--primary btn--block verify-card__cta"
            onClick={() => router.push(`/login?redirect=/devices/verify${codeFromUrl ? `?code=${codeFromUrl}` : ''}`)}
          >
            {t('verify.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing verify-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="verify-page__brand">
          {/* Umschaltung über eigenes CSS statt Tailwinds dark:-Varianten:
              auf dieser Seite lädt kein Tailwind, weshalb zuvor beide
              Logos nebeneinander standen. */}
          <Image
            src="/logo_dark.png"
            alt="OpenEOS"
            width={180}
            height={48}
            className="verify-logo verify-logo--forLight"
          />
          <Image
            src="/logo_light.png"
            alt="OpenEOS"
            width={180}
            height={48}
            className="verify-logo verify-logo--forDark"
          />
        </div>

        {/* Enter Code Step */}
        {step === 'enter-code' && (
          <div className="app-card verify-card">
            <div className="mb-6 text-center">
              <div className="verify-card__icon">
                <Tv01 />
              </div>
              <h1 className="text-2xl font-bold text-primary">{t('verify.title')}</h1>
              <p className="mt-2 text-tertiary">{t('verify.enterCodeDescription')}</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLookup(); }}>
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-center block">{t('verify.code')}</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={setCode}
                  placeholder="000000"
                  maxLength={6}
                  className="h-16 text-center text-4xl tracking-[0.4em] font-mono indent-[0.2em]"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn--primary btn--block verify-card__cta"
                disabled={code.length !== 6 || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? (
                  <Loading02 className="h-5 w-5 animate-spin" />
                ) : (
                  t('verify.lookup')
                )}
              </button>
            </form>
          </div>
        )}

        {/* Configure Step */}
        {step === 'configure' && pendingDevice && (
          <div className="app-card verify-card">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
                <CheckCircle className="h-6 w-6 text-success-primary" />
              </div>
              <h2 className="text-xl font-semibold text-primary">{t('verify.deviceFound')}</h2>
              <p className="mt-2 text-sm text-tertiary">
                {pendingDevice.userAgent || 'OpenEOS TV'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Organization Select (if multiple) */}
              {organizations && organizations.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="organization">{t('verify.organization')}</Label>
                  <Select
                    selectedKey={selectedOrgId || null}
                    onSelectionChange={(value) => setSelectedOrgId(value as string ?? '')}
                    placeholder={t('verify.selectOrganization')}
                  >
                    {organizations.map((org) => (
                      <Select.Item key={org.organizationId} id={org.organizationId}>
                        {org.organization?.name ?? org.organizationId}
                      </Select.Item>
                    ))}
                  </Select>
                </div>
              )}

              {/* Device Name */}
              <div className="space-y-1.5">
                <Label htmlFor="deviceName">{t('verify.deviceName')}</Label>
                <Input
                  id="deviceName"
                  value={deviceName}
                  onChange={setDeviceName}
                  placeholder="z.B. Küchen-Display"
                />
              </div>

              {/* Device Type */}
              <div className="space-y-1.5">
                <Label htmlFor="deviceType">{t('verify.deviceType')}</Label>
                <Select
                  selectedKey={deviceType}
                  onSelectionChange={(value) => setDeviceType(value as DeviceClass)}
                >
                  {DEVICE_TYPE_VALUES.map((type) => (
                    <Select.Item key={type} id={type}>
                      {t(`class.${type}`)}
                    </Select.Item>
                  ))}
                </Select>
              </div>

              {error && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {error}
                </div>
              )}

              <div className="verify-card__row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setStep('enter-code');
                    setPendingDevice(null);
                  }}
                >
                  {tCommon('back')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleLink}
                  disabled={linkMutation.isPending || !selectedOrgId}
                >
                  {linkMutation.isPending ? '…' : t('verify.link')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="app-card verify-card verify-card--center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
              <CheckCircle className="h-6 w-6 text-success-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('verify.success')}</h2>
            <p className="mt-2 text-tertiary">{t('verify.successDescription')}</p>
            <button type="button" className="btn btn--primary btn--block verify-card__cta" onClick={handleGoToDashboard}>
              {t('verify.goToDashboard')}
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="app-card verify-card verify-card--center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
              <AlertCircle className="h-6 w-6 text-error-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('verify.error')}</h2>
            <p className="mt-2 text-tertiary">{error}</p>
            <button
              type="button"
              className="btn btn--ghost btn--block verify-card__cta"
              onClick={() => {
                setStep('enter-code');
                setError(null);
              }}
            >
              {t('verify.tryAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
