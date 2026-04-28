'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';

type Step = 'enter-code' | 'configure' | 'success';

const DEVICE_TYPE_VALUES: DeviceClass[] = ['display', 'pos', 'admin'];

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

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceClass>('display');

  useEffect(() => {
    if (currentOrganization) {
      setSelectedOrgId(currentOrganization.organizationId);
    } else if (organizations && organizations.length === 1) {
      setSelectedOrgId(organizations[0].organizationId);
    }
  }, [organizations, currentOrganization]);

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

  const linkMutation = useMutation({
    mutationFn: () =>
      devicesApi.link({ code, organizationId: selectedOrgId, name: deviceName, deviceType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setStep('success');
    },
    onError: () => {
      setError(t('verify.linkFailed'));
    },
  });

  const handleLookup = () => {
    if (code.length !== 6) { setError(t('verify.invalidCode')); return; }
    setError(null);
    lookupMutation.mutate(code);
  };

  const handleLink = () => {
    if (!selectedOrgId) { setError(t('verify.selectOrganization')); return; }
    if (!deviceName.trim()) { setError(t('verify.enterName')); return; }
    setError(null);
    linkMutation.mutate();
  };

  const getTitle = () => {
    if (step === 'enter-code') return t('verify.title');
    if (step === 'configure') return t('verify.deviceFound');
    return t('verify.success');
  };

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{getTitle()}</h2>
          <button className="modal__close" type="button" onClick={onClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Enter Code Step */}
        {step === 'enter-code' && (
          <form onSubmit={(e) => { e.preventDefault(); handleLookup(); }}>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 20 }}>
                {t('verify.enterCodeDescription')}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 16,
                  background: 'var(--green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </div>
              </div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'center', color: 'var(--ink)' }}>
                {t('verify.code')}
              </label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={{ textAlign: 'center', fontSize: 32, letterSpacing: '0.35em', fontFamily: 'var(--f-mono)', height: 64 }}
              />

              {error && (
                <p style={{ color: '#d24545', fontSize: 13, marginTop: 8 }}>{error}</p>
              )}
            </div>

            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={code.length !== 6 || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? '...' : t('verify.lookup')}
              </button>
            </div>
          </form>
        )}

        {/* Configure Step */}
        {step === 'configure' && pendingDevice && (
          <>
            <div className="modal__body">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--green-ink) 12%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', textAlign: 'center', marginBottom: 20 }}>
                {pendingDevice.userAgent || 'OpenEOS TV'}
              </p>

              {organizations && organizations.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
                    {t('verify.organization')}
                  </label>
                  <select
                    className="select"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    <option value="">{t('verify.selectOrganization')}</option>
                    {organizations.map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.organization?.name ?? org.organizationId}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
                  {t('verify.deviceName')}
                </label>
                <input
                  className="input"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="z.B. Küchen-Display"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
                  {t('verify.deviceType')}
                </label>
                <select
                  className="select"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceClass)}
                >
                  {DEVICE_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>{t(`class.${type}`)}</option>
                  ))}
                </select>
              </div>

              {error && (
                <p style={{ color: '#d24545', fontSize: 13 }}>{error}</p>
              )}
            </div>

            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setStep('enter-code'); setPendingDevice(null); }}
              >
                {tCommon('back')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleLink}
                disabled={linkMutation.isPending || !selectedOrgId}
              >
                {linkMutation.isPending ? '...' : t('verify.link')}
              </button>
            </div>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <>
            <div className="modal__body">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--green-ink) 12%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <p style={{ fontSize: 14, textAlign: 'center', color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                {t('verify.successDescription')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                {tCommon('close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
