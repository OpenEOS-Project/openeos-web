'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { toast } from '@/components/shared/toast';

type KitchenTicketMode = 'per_order' | 'per_item' | 'per_station';

const MODES: KitchenTicketMode[] = ['per_order', 'per_item', 'per_station'];

export function KitchenTicketModePanel() {
  const t = useTranslations();
  const tp = useTranslations('printers.kitchenTicketMode');
  const options = MODES.map((value) => ({
    value,
    title: tp(`modes.${value}.title`),
    description: tp(`modes.${value}.description`),
  }));
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const orgId = currentOrganization?.organizationId;
  const initialMode: KitchenTicketMode =
    (currentOrganization?.organization?.settings?.orderFlow?.kitchenTicketPrinting?.mode as KitchenTicketMode) ||
    'per_order';
  const [mode, setMode] = useState<KitchenTicketMode>(initialMode);

  const saveMode = useMutation({
    mutationFn: async (next: KitchenTicketMode) => {
      if (!orgId || !currentOrganization?.organization) {
        throw new Error('Organisation fehlt');
      }
      const currentSettings = currentOrganization.organization.settings ?? {};
      const orderFlow = currentSettings.orderFlow ?? {};
      const kitchen = orderFlow.kitchenTicketPrinting ?? {
        enabled: false,
        printerId: null,
        templateId: null,
      };
      const mergedSettings = {
        ...currentSettings,
        orderFlow: {
          ...orderFlow,
          kitchenTicketPrinting: { ...kitchen, mode: next },
        },
      } as typeof currentSettings;
      const response = await organizationsApi.update(orgId, { settings: mergedSettings });
      return response.data;
    },
    onSuccess: (org) => {
      if (currentOrganization) {
        setCurrentOrganization({ ...currentOrganization, organization: org });
      }
      toast.success(tp('saved'));
    },
    onError: () => {
      toast.error(t('common.saveFailed'));
    },
  });

  const handleChange = (next: KitchenTicketMode) => {
    setMode(next);
    saveMode.mutate(next);
  };

  return (
    <section
      className="app-card"
      style={{
        marginBottom: 16,
        background: 'color-mix(in oklab, var(--green-soft) 18%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--green-ink) 18%, transparent)',
      }}
    >
      <div className="app-card__head" style={{ display: 'block' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{tp('title')}</div>
        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 2 }}>
          {tp('description')}
        </div>
      </div>

      <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 12,
              borderRadius: 10,
              border: `1px solid ${mode === opt.value ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 10%, transparent)'}`,
              background: mode === opt.value
                ? 'color-mix(in oklab, var(--green-soft) 35%, var(--paper))'
                : 'var(--paper)',
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          >
            <input
              type="radio"
              name="kitchen-ticket-mode"
              value={opt.value}
              checked={mode === opt.value}
              onChange={() => handleChange(opt.value)}
              style={{ marginTop: 4, accentColor: 'var(--green-ink)' }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 2 }}>
                {opt.description}
              </div>
            </div>
          </label>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 4 }}>
          {saveMode.isPending && <span>{t('common.saving')}</span>}
        </div>
      </div>
    </section>
  );
}
