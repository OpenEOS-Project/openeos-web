'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { ShiftRegistration } from '@/types/shift';

interface SendMessageModalProps {
  open: boolean;
  registration: ShiftRegistration | null;
  onClose: () => void;
}

export function SendMessageModal({ open, registration, onClose }: SendMessageModalProps) {
  const t = useTranslations();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => shiftsApi.sendMessage(organizationId!, registration!.id, message),
    onSuccess: () => { setMessage(''); onClose(); },
    onError: (err: Error) => setError(err.message || 'Ein Fehler ist aufgetreten'),
  });

  const handleClose = () => { setMessage(''); setError(null); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !registration) return;
    setError(null);
    sendMutation.mutate();
  };

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.registration.sendMessage')}</div>
          <button className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>{error}</div>
              )}
              {registration && (
                <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                  Nachricht an: <strong>{registration.name}</strong> ({registration.email})
                </p>
              )}
              <div className="auth-field">
                <textarea
                  className="textarea"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('shifts.registration.messagePlaceholder')}
                />
              </div>
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={!message.trim() || sendMutation.isPending}>
              {sendMutation.isPending ? '...' : t('shifts.registration.sendMessage')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
