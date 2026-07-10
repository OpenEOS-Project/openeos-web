'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-client';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
import { toast } from '@/components/shared/toast';
import type { AdminNotifyOnSettings } from '@/types/admin';

const DEFAULT_NOTIFY_ON: AdminNotifyOnSettings = {
  userRegistered: true,
  organizationCreated: true,
  eventOrdered: true,
};

const NOTIFY_ON_KEYS: (keyof AdminNotifyOnSettings)[] = ['userRegistered', 'organizationCreated', 'eventOrdered'];

export function PlatformNotificationsSection() {
  const t = useTranslations('settings.platform');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['admin', 'notification-settings'],
    queryFn: async () => {
      const response = await adminApi.getNotificationSettings();
      return response.data;
    },
  });

  const [email, setEmail] = useState('');
  const [notifyOn, setNotifyOn] = useState<AdminNotifyOnSettings>(DEFAULT_NOTIFY_ON);

  useEffect(() => {
    if (settingsQuery.data) {
      setEmail(settingsQuery.data.email || '');
      setNotifyOn({ ...DEFAULT_NOTIFY_ON, ...settingsQuery.data.notifyOn });
    }
  }, [settingsQuery.data]);

  const updateSettings = useMutation({
    mutationFn: async () => {
      const response = await adminApi.updateNotificationSettings({
        email: email.trim() || null,
        notifyOn,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setEmail(data.email || '');
      setNotifyOn({ ...DEFAULT_NOTIFY_ON, ...data.notifyOn });
      queryClient.invalidateQueries({ queryKey: ['admin', 'notification-settings'] });
      toast.success(t('saved'));
    },
    onError: () => {
      toast.error(t('saveFailed'));
    },
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="app-card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ width: 24, height: 24, margin: '0 auto', borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="app-card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('description')}</p>
      </div>

      <div className="auth-field" style={{ marginBottom: 20 }}>
        <label className="auth-field__label" htmlFor="platformNotifyEmail">{t('email')}</label>
        <input
          id="platformNotifyEmail"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
        />
        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>{t('emailDescription')}</p>
      </div>

      <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)', borderRadius: 10, overflow: 'hidden' }}>
        {NOTIFY_ON_KEYS.map((key, i) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: i < NOTIFY_ON_KEYS.length - 1 ? '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' : 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`notifyOn.${key}`)}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t(`notifyOn.${key}Description`)}</div>
            </div>
            <ToggleSwitch
              checked={notifyOn[key]}
              onChange={(value) => setNotifyOn((prev) => ({ ...prev, [key]: value }))}
              disabled={updateSettings.isPending}
              aria-label={t(`notifyOn.${key}`)}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, marginTop: 4 }}>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => updateSettings.mutate()}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
    </div>
  );
}
