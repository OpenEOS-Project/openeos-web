'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { Device } from '@/types/device';

interface VerifyDeviceDialogProps {
  device: Device;
  onClose: () => void;
}

export function VerifyDeviceDialog({ device, onClose }: VerifyDeviceDialogProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: () => devicesApi.verify(organizationId!, device.id, { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      onClose();
    },
    onError: () => {
      setError(t('verifyDialog.invalidCode'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    verifyMutation.mutate();
  };

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('verifyDialog.title')}</h2>
          <button className="modal__close" type="button" onClick={onClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
              {t('verifyDialog.description')}
            </p>

            <div style={{
              background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
              borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 16,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{device.name}</p>
            </div>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
              {t('verifyDialog.code')}
            </label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('verifyDialog.codePlaceholder')}
              maxLength={6}
              autoFocus
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.3em', fontFamily: 'var(--f-mono)' }}
            />

            {error && (
              <p style={{ color: '#d24545', fontSize: 13, marginTop: 8, margin: 0 }}>{error}</p>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!code.trim() || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? '...' : t('verifyDialog.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
