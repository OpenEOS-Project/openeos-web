'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';

type KitchenTicketMode = 'per_order' | 'per_item' | 'per_station';

const OPTIONS: { value: KitchenTicketMode; title: string; description: string }[] = [
  {
    value: 'per_order',
    title: '1 Bon pro Bestellung',
    description:
      'Klassisch: alles auf einem Küchenbon. Einfach für kleine Küchen ohne Stationstrennung.',
  },
  {
    value: 'per_item',
    title: '1 Bon pro Produkt (Barcode)',
    description:
      'Jedes Produkt aus der Bestellung bekommt einen eigenen Bon mit einem eindeutigen Barcode — ideal um den Status einzelner Produkte später per Scanner zu verfolgen.',
  },
  {
    value: 'per_station',
    title: '1 Bon pro Produktionsstation',
    description:
      'Die Bestellung wird nach Produktionsstation gruppiert. Jede Station bekommt nur ihre Produkte. Ist der Station ein eigener Drucker zugewiesen, wird der Bon dort gedruckt — sonst auf dem Standard-Küchendrucker.',
  },
];

export function KitchenTicketModePanel() {
  const t = useTranslations();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const orgId = currentOrganization?.organizationId;
  const initialMode: KitchenTicketMode =
    (currentOrganization?.organization?.settings?.orderFlow?.kitchenTicketPrinting?.mode as KitchenTicketMode) ||
    'per_order';
  const [mode, setMode] = useState<KitchenTicketMode>(initialMode);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 1800);
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
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Modus für Küchenbon-Druck</div>
        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 2 }}>
          Bestimmt, wie Küchenbons bei einer neuen Bestellung erzeugt werden.
        </div>
      </div>

      <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OPTIONS.map((opt) => (
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
          {saveMode.isPending && <span>Speichert…</span>}
          {savedAt && <span style={{ color: 'var(--green-ink)' }}>✓ Gespeichert</span>}
          {saveMode.error && <span style={{ color: 'var(--danger)' }}>{t('common.saveFailed')}</span>}
        </div>
      </div>
    </section>
  );
}
