'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { CheckCircle, AlertCircle, Tv01, Loading02 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi, organizationsApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';

type Step = 'enter-code' | 'configure' | 'success' | 'error';

const DEVICE_TYPE_VALUES: DeviceClass[] = [
  'display_menu',
  'display_kitchen',
  'display_delivery',
  'display_pickup',
  'display_sales',
  'pos',
];

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
  const [deviceType, setDeviceType] = useState<DeviceClass>('display_menu');

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
      setDeviceType(device.deviceType || 'display_menu');
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
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <div className="w-full max-w-md rounded-xl border border-secondary bg-primary p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary">
            <Tv01 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">{t('verify.title')}</h1>
          <p className="mt-2 text-tertiary">{t('verify.loginRequired')}</p>
          <Button
            className="mt-6 w-full"
            onClick={() => router.push(`/login?redirect=/devices/verify${codeFromUrl ? `?code=${codeFromUrl}` : ''}`)}
          >
            {t('verify.login')}
          </Button>
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

        {/* Enter Code Step */}
        {step === 'enter-code' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary">
                <Tv01 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-primary">{t('verify.title')}</h1>
              <p className="mt-2 text-tertiary">{t('verify.enterCodeDescription')}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">{t('verify.code')}</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={setCode}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-3xl tracking-[0.5em] font-mono"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleLookup}
                disabled={code.length !== 6 || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? (
                  <Loading02 className="h-5 w-5 animate-spin" />
                ) : (
                  t('verify.lookup')
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Configure Step */}
        {step === 'configure' && pendingDevice && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm">
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

              <div className="flex gap-3 pt-2">
                <Button
                  color="secondary"
                  className="flex-1"
                  onClick={() => {
                    setStep('enter-code');
                    setPendingDevice(null);
                  }}
                >
                  {tCommon('back')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleLink}
                  disabled={linkMutation.isPending || !selectedOrgId}
                >
                  {linkMutation.isPending ? (
                    <Loading02 className="h-5 w-5 animate-spin" />
                  ) : (
                    t('verify.link')
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
              <CheckCircle className="h-6 w-6 text-success-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('verify.success')}</h2>
            <p className="mt-2 text-tertiary">{t('verify.successDescription')}</p>
            <Button className="mt-6 w-full" onClick={handleGoToDashboard}>
              {t('verify.goToDashboard')}
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="rounded-xl border border-secondary bg-primary p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-secondary">
              <AlertCircle className="h-6 w-6 text-error-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">{t('verify.error')}</h2>
            <p className="mt-2 text-tertiary">{error}</p>
            <Button
              color="secondary"
              className="mt-6 w-full"
              onClick={() => {
                setStep('enter-code');
                setError(null);
              }}
            >
              {t('verify.tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
