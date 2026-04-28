'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';

type MessageType = 'info' | 'warning' | 'success' | 'error';

interface BroadcastDialogProps {
  onClose: () => void;
  onlineDeviceCount: number;
}

const typeBadgeClass: Record<MessageType, string> = {
  info: 'badge badge--info',
  warning: 'badge badge--warning',
  success: 'badge badge--success',
  error: 'badge badge--error',
};

export function BroadcastDialog({ onClose, onlineDeviceCount }: BroadcastDialogProps) {
  const t = useTranslations('devices.broadcast');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');

  const broadcastMutation = useMutation({
    mutationFn: () =>
      organizationsApi.broadcast(organizationId!, { message, type: messageType }),
    onSuccess: () => { onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    broadcastMutation.mutate();
  };

  const types: MessageType[] = ['info', 'warning', 'success', 'error'];

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('title')}</h2>
          <button className="modal__close" type="button" onClick={onClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
              {t('description')}
            </p>

            {onlineDeviceCount === 0 && (
              <div style={{
                background: 'color-mix(in oklab, #f59e0b 10%, transparent)',
                border: '1px solid color-mix(in oklab, #f59e0b 25%, transparent)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>{t('noDevicesOnline')}</p>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>
                {t('message')}
              </label>
              <input
                className="input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
                {t('messageType')}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMessageType(type)}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `2px solid ${messageType === type ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)'}`,
                      background: messageType === type ? 'color-mix(in oklab, var(--green-ink) 10%, transparent)' : 'transparent',
                      color: messageType === type ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
                    }}
                  >
                    <span className={typeBadgeClass[type]} style={{ pointerEvents: 'none' }}>
                      {t(`types.${type}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!message.trim() || broadcastMutation.isPending || onlineDeviceCount === 0}
            >
              {broadcastMutation.isPending ? t('sending') : t('send')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
