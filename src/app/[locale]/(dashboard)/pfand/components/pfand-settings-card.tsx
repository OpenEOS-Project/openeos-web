'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { ToggleSwitch } from '@/components/shared/toggle-switch';

type PfandPolicy = { tableService: boolean; counterPickup: boolean };

const DEFAULTS: PfandPolicy = { tableService: false, counterPickup: true };

export function PfandSettingsCard() {
  const t = useTranslations('pfand.settings');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const policy = {
    ...DEFAULTS,
    ...(currentOrganization?.organization?.settings?.pfand ?? {}),
  };

  const updatePolicy = useMutation({
    mutationFn: async (next: Partial<PfandPolicy>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: {
          ...currentOrganization.organization?.settings,
          pfand: { ...policy, ...next },
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  if (!currentOrganization) return null;

  const rows: { key: keyof PfandPolicy }[] = [
    { key: 'tableService' },
    { key: 'counterPickup' },
  ];

  return (
    <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('title')}</h3>
        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>
          {t('description')}
        </p>
      </div>

      {rows.map(({ key }, i, arr) => {
        const isChecked = policy[key];
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
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t(`${key}.label`)}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                {t(`${key}.description`)}
              </div>
            </div>
            <ToggleSwitch
              checked={isChecked}
              onChange={() => updatePolicy.mutate({ [key]: !isChecked })}
              disabled={updatePolicy.isPending}
              aria-label={t(`${key}.label`)}
            />
          </div>
        );
      })}
    </div>
  );
}
