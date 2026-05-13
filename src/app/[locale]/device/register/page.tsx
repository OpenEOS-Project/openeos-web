'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tablet02, CheckCircle, XCircle, Loading02 } from '@untitledui/icons';
import { useDeviceStore } from '@/stores/device-store';

type RegistrationStep = 'form' | 'pending' | 'verified' | 'blocked';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  background: 'var(--pos-surface)',
  border: '1px solid var(--pos-line)',
  borderRadius: 'var(--pos-r-sm)',
  fontSize: 14,
  color: 'var(--pos-ink)',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color .12s, box-shadow .12s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--pos-ink-2)',
  marginBottom: 6,
  letterSpacing: '0.01em',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--pos-surface)',
  border: '1px solid var(--pos-line)',
  borderRadius: 'var(--pos-r-lg)',
  boxShadow: 'var(--pos-sh-2)',
  padding: 28,
};

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

  const orgFromUrl = searchParams.get('org') || '';
  const [name, setName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState(orgFromUrl);
  const [step, setStep] = useState<RegistrationStep>('form');

  useEffect(() => {
    if (status === 'verified') {
      setStep('verified');
      const timer = setTimeout(() => {
        const { deviceClass, settings } = useDeviceStore.getState();
        const targetRoute = deviceClass === 'display' && (settings as { displayMode?: string })?.displayMode === 'station'
          ? '/device/station'
          : '/device/pos';
        router.push(targetRoute);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (status === 'blocked') {
      setStep('blocked');
    } else if (status === 'pending' && verificationCode) {
      setStep('pending');
    }
  }, [status, verificationCode, router]);

  useEffect(() => {
    if (step === 'pending' || step === 'blocked') {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [step, startPolling, stopPolling]);

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

  const canSubmit = !isLoading && !!name.trim() && !!organizationSlug.trim();

  return (
    <div
      className="pos-root"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--pos-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 'var(--pos-r-lg)',
              background: 'var(--pos-accent)',
              margin: '0 auto 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--pos-sh-2)',
            }}
          >
            <Tablet02 style={{ width: 32, height: 32, color: 'var(--pos-accent-contrast)' }} />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--pos-ink)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {t('register.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--pos-ink-3)', margin: '6px 0 0' }}>
            {t('register.subtitle')}
          </p>
        </div>

        {/* Registration Form */}
        {step === 'form' && (
          <div style={cardStyle}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="organizationSlug" style={labelStyle}>
                  {t('register.organizationSlug')}
                </label>
                <input
                  id="organizationSlug"
                  type="text"
                  value={organizationSlug}
                  onChange={(e) => setOrganizationSlug(e.target.value)}
                  placeholder={t('register.organizationSlugPlaceholder')}
                  autoComplete="off"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pos-accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in oklab, var(--pos-accent) 25%, transparent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pos-line)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--pos-ink-3)', margin: '6px 0 0' }}>
                  {t('register.organizationSlugHint')}
                </p>
              </div>

              <div>
                <label htmlFor="name" style={labelStyle}>
                  {t('register.deviceName')}
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('register.deviceNamePlaceholder')}
                  autoComplete="off"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pos-accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in oklab, var(--pos-accent) 25%, transparent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--pos-line)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: '11px 14px',
                    background: 'color-mix(in oklab, var(--pos-danger) 12%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--pos-danger) 30%, transparent)',
                    borderRadius: 'var(--pos-r-sm)',
                    fontSize: 13,
                    color: 'var(--pos-danger)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: canSubmit ? 'var(--pos-accent)' : 'var(--pos-line)',
                  color: canSubmit ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
                  border: 'none',
                  borderRadius: 'var(--pos-r-sm)',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  marginTop: 4,
                }}
              >
                {isLoading ? t('register.registering') : t('register.submit')}
              </button>
            </form>
          </div>
        )}

        {/* Pending Verification */}
        {step === 'pending' && (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'color-mix(in oklab, var(--pos-warn) 16%, var(--pos-surface))',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loading02
                style={{ width: 28, height: 28, color: 'var(--pos-warn)', animation: 'spin 1s linear infinite' }}
              />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--pos-ink)', margin: 0 }}>
              {t('register.pendingTitle')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--pos-ink-3)', margin: '6px 0 18px' }}>
              {t('register.pendingDescription')}
            </p>

            {organizationName && (
              <p style={{ fontSize: 13, color: 'var(--pos-ink-2)', margin: '0 0 16px' }}>
                {t('register.organization')}:{' '}
                <strong style={{ color: 'var(--pos-ink)' }}>{organizationName}</strong>
              </p>
            )}

            <div
              style={{
                padding: '20px 16px',
                background: 'var(--pos-surface-2)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-md)',
                marginBottom: 18,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--pos-ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  margin: '0 0 8px',
                }}
              >
                {t('register.verificationCode')}
              </p>
              <div
                className="pos-mono"
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  color: 'var(--pos-accent)',
                  letterSpacing: '0.08em',
                  lineHeight: 1.1,
                }}
              >
                {verificationCode}
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--pos-ink-3)', margin: '0 0 18px' }}>
              {t('register.pendingHint')}
            </p>

            <button
              type="button"
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '11px',
                background: 'var(--pos-surface)',
                color: 'var(--pos-ink)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('register.cancel')}
            </button>
          </div>
        )}

        {/* Verified */}
        {step === 'verified' && (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'color-mix(in oklab, var(--pos-ok) 16%, var(--pos-surface))',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle style={{ width: 28, height: 28, color: 'var(--pos-ok)' }} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--pos-ink)', margin: 0 }}>
              {t('register.verifiedTitle')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--pos-ink-3)', margin: '6px 0 12px' }}>
              {t('register.verifiedDescription')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--pos-ink-2)', margin: 0 }}>
              {t('register.redirecting')}
            </p>
          </div>
        )}

        {/* Blocked */}
        {step === 'blocked' && (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'color-mix(in oklab, var(--pos-danger) 14%, var(--pos-surface))',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle style={{ width: 28, height: 28, color: 'var(--pos-danger)' }} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--pos-ink)', margin: 0 }}>
              {t('register.blockedTitle')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--pos-ink-3)', margin: '6px 0 18px' }}>
              {t('register.blockedDescription')}
            </p>

            <button
              type="button"
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '11px',
                background: 'var(--pos-surface)',
                color: 'var(--pos-ink)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-sm)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('register.tryAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
