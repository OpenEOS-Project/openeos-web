'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Tv01, Loading02 } from '@untitledui/icons';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';

type Step = 'enter-code' | 'configure' | 'success';

const DEVICE_TYPE_VALUES: DeviceClass[] = [
  'display_menu',
  'display_kitchen',
  'display_delivery',
  'display_pickup',
  'display_sales',
  'display_customer',
  'pos',
  'admin',
];

interface LinkDeviceModalProps {
  onClose: () => void;
}

export function LinkDeviceModal({ onClose }: LinkDeviceModalProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { organizations, currentOrganization } = useAuthStore();

  const [step, setStep] = useState<Step>('enter-code');
  const [code, setCode] = useState('');
  const [pendingDevice, setPendingDevice] = useState<PendingDeviceLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state for configuration
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceClass>('display_menu');

  // Set default organization
  useEffect(() => {
    if (currentOrganization) {
      setSelectedOrgId(currentOrganization.organizationId);
    } else if (organizations && organizations.length === 1) {
      setSelectedOrgId(organizations[0].organizationId);
    }
  }, [organizations, currentOrganization]);

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
    mutationFn: () =>
      devicesApi.link({
        code,
        organizationId: selectedOrgId,
        name: deviceName,
        deviceType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
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

  const getTitle = () => {
    switch (step) {
      case 'enter-code':
        return t('verify.title');
      case 'configure':
        return t('verify.deviceFound');
      case 'success':
        return t('verify.success');
    }
  };

  const getDescription = () => {
    switch (step) {
      case 'enter-code':
        return t('verify.enterCodeDescription');
      case 'configure':
        return pendingDevice?.userAgent || 'OpenEOS TV';
      case 'success':
        return t('verify.successDescription');
    }
  };

  return (
    <DialogModal isOpen onClose={onClose} title={getTitle()} description={getDescription()}>
      {/* Enter Code Step */}
      {step === 'enter-code' && (
        <>
          <div className="space-y-4 px-6 py-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary">
                <Tv01 className="h-8 w-8 text-white" />
              </div>
            </div>

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
          </div>

          <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
            <Button type="button" color="secondary" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button
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
        </>
      )}

      {/* Configure Step */}
      {step === 'configure' && pendingDevice && (
        <>
          <div className="space-y-4 px-6 py-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
                <CheckCircle className="h-6 w-6 text-success-primary" />
              </div>
            </div>

            {/* Organization Select (if multiple) */}
            {organizations && organizations.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="organization">{t('verify.organization')}</Label>
                <Select
                  selectedKey={selectedOrgId || null}
                  onSelectionChange={(value) => setSelectedOrgId((value as string) ?? '')}
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
          </div>

          <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
            <Button
              color="secondary"
              onClick={() => {
                setStep('enter-code');
                setPendingDevice(null);
              }}
            >
              {tCommon('back')}
            </Button>
            <Button onClick={handleLink} disabled={linkMutation.isPending || !selectedOrgId}>
              {linkMutation.isPending ? (
                <Loading02 className="h-5 w-5 animate-spin" />
              ) : (
                t('verify.link')
              )}
            </Button>
          </div>
        </>
      )}

      {/* Success Step */}
      {step === 'success' && (
        <>
          <div className="space-y-4 px-6 py-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-secondary">
                <CheckCircle className="h-6 w-6 text-success-primary" />
              </div>
            </div>
            <p className="text-center text-tertiary">{t('verify.successDescription')}</p>
          </div>

          <div className="flex justify-end border-t border-secondary px-6 py-4">
            <Button onClick={onClose}>{tCommon('close')}</Button>
          </div>
        </>
      )}
    </DialogModal>
  );
}
