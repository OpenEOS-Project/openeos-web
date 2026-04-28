'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';

export function DeviceRegistrationInfo() {
  const t = useTranslations('devices');
  const { currentOrganization } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const organizationSlug = currentOrganization?.organization?.slug;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const registrationUrl = organizationSlug
    ? `${baseUrl}/device/register?org=${organizationSlug}`
    : `${baseUrl}/device/register`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!organizationSlug) return null;

  return (
    <div className="app-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* QR Code */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              borderRadius: 10, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
              background: '#fff', padding: 12, display: 'inline-block',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR Code für Geräte-Registrierung" width={160} height={160} />
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>
                {t('registration.title')}
              </h3>
              <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                {t('registration.description')}
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {t('registration.link')}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{
                  flex: 1, fontSize: 12, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  background: 'color-mix(in oklab, var(--ink) 3%, transparent)',
                  color: 'var(--ink)', wordBreak: 'break-all', fontFamily: 'var(--f-mono)',
                }}>
                  {registrationUrl}
                </code>
                <button className="btn btn--ghost" style={{ flexShrink: 0, padding: '8px 12px' }} onClick={handleCopy}>
                  {copied ? '✓' : 'Kopieren'}
                </button>
              </div>
            </div>

            <div style={{
              background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>
                {t('registration.instructions')}
              </h4>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>{t('registration.step1')}</li>
                <li style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>{t('registration.step2')}</li>
                <li style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 65%, transparent)' }}>{t('registration.step3')}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
