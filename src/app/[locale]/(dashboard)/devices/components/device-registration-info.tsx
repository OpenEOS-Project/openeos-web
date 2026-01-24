'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy01, CheckCircle, QrCode01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { useAuthStore } from '@/stores/auth-store';

export function DeviceRegistrationInfo() {
  const t = useTranslations('devices');
  const { currentOrganization } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const organizationSlug = currentOrganization?.organization?.slug;

  // Build the registration URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const registrationUrl = organizationSlug
    ? `${baseUrl}/device/register?org=${organizationSlug}`
    : `${baseUrl}/device/register`;

  // QR Code API URL (using goqr.me free API)
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

  if (!organizationSlug) {
    return null;
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* QR Code */}
        <div className="flex-shrink-0">
          <div className="rounded-lg border border-secondary bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCodeUrl}
              alt="QR Code für Geräte-Registrierung"
              width={200}
              height={200}
              className="h-[200px] w-[200px]"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <QrCode01 className="h-5 w-5 text-brand-primary" />
              <h3 className="text-lg font-semibold text-primary">
                {t('registration.title')}
              </h3>
            </div>
            <p className="mt-1 text-sm text-tertiary">
              {t('registration.description')}
            </p>
          </div>

          {/* Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-secondary">
              {t('registration.link')}
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-secondary bg-secondary px-3 py-2 text-sm text-primary break-all">
                {registrationUrl}
              </code>
              <Button
                color="secondary"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-success-primary" />
                ) : (
                  <Copy01 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-secondary p-4">
            <h4 className="text-sm font-medium text-primary">
              {t('registration.instructions')}
            </h4>
            <ol className="mt-2 space-y-1 text-sm text-tertiary list-decimal list-inside">
              <li>{t('registration.step1')}</li>
              <li>{t('registration.step2')}</li>
              <li>{t('registration.step3')}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
