'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';

export function OrganizationPosSection() {
  const t = useTranslations('settings.organizationPos');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const posSettings = currentOrganization?.organization?.settings?.pos;

  const defaultPosSettings: {
    requireTableNumber: boolean;
    autoPrintReceipt: boolean;
    soundEnabled: boolean;
    orderingMode: 'immediate' | 'tab';
  } = {
    requireTableNumber: false,
    autoPrintReceipt: false,
    soundEnabled: true,
    orderingMode: 'immediate',
  };

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<typeof defaultPosSettings>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: {
          ...currentOrganization.organization?.settings,
          pos: {
            ...defaultPosSettings,
            ...posSettings,
            ...settings,
          },
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({
          ...currentOrganization,
          organization: data,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const orderingModes = [
    {
      id: 'immediate',
      label: t('orderingMode.immediate'),
      description: t('orderingMode.immediateDescription'),
    },
    {
      id: 'tab',
      label: t('orderingMode.tab'),
      description: t('orderingMode.tabDescription'),
    },
  ];

  const currentMode = posSettings?.orderingMode || 'immediate';

  const handleModeChange = async (mode: 'immediate' | 'tab') => {
    await updateSettings.mutateAsync({ orderingMode: mode });
  };

  const handleToggleChange = async (key: 'requireTableNumber' | 'autoPrintReceipt' | 'soundEnabled', value: boolean) => {
    await updateSettings.mutateAsync({ [key]: value });
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ordering Mode */}
      <div className="app-card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('orderingMode.title')}</h3>
          <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('orderingMode.description')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {orderingModes.map((mode) => {
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeChange(mode.id as 'immediate' | 'tab')}
                disabled={updateSettings.isPending}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: '14px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: isActive ? '2px solid var(--green-ink)' : '2px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                  background: isActive ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))' : 'none',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', top: 8, right: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--green-ink)' : 'inherit' }}>
                  {mode.label}
                </span>
                <span style={{ fontSize: 12, color: isActive ? 'color-mix(in oklab, var(--green-ink) 70%, transparent)' : 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                  {mode.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Other POS Settings */}
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('options.title')}</h3>
        </div>

        {(
          [
            { key: 'requireTableNumber', defaultValue: false },
            { key: 'autoPrintReceipt', defaultValue: false },
            { key: 'soundEnabled', defaultValue: true },
          ] as const
        ).map(({ key, defaultValue }, i, arr) => {
          const isChecked = posSettings?.[key] ?? defaultValue;
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid color-mix(in oklab, var(--ink) 5%, transparent)' : 'none',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`options.${key}`)}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t(`options.${key}Description`)}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isChecked}
                disabled={updateSettings.isPending}
                onClick={() => handleToggleChange(key, !isChecked)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: isChecked ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 18%, transparent)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: isChecked ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
