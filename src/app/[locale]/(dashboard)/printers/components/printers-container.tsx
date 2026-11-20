'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PrintHealthBanner } from '@/components/printers/print-health-banner';
import { useAuthStore } from '@/stores/auth-store';
import { PrintersList } from './printers-list';
import { TemplatesTab } from './templates-tab';
import { OrderFlowTab } from './order-flow-tab';

export function PrintersContainer() {
  const t = useTranslations('printers');
  const [activeTab, setActiveTab] = useState<string>('printers');
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId) || '';

  const tabs = [
    { id: 'printers', label: t('tabs.printers') },
    { id: 'templates', label: t('tabs.templates') },
    { id: 'orderFlow', label: t('tabs.orderFlow') },
  ];

  return (
    <div>
      {/* Auf jedem Reiter sichtbar. Auf dem Reiter „Drucker“ laeuft schon
          die Live-Verbindung der Liste (usePrinterLiveUpdates), die den
          Zustand mit auffrischt. */}
      {organizationId && (
        <PrintHealthBanner
          organizationId={organizationId}
          live={activeTab !== 'printers'}
          className="print-health-banner--page"
        />
      )}
      {/* Tab bar */}
      <div style={{
        borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
        display: 'flex', gap: 0, marginBottom: 24,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--green-ink)'
                : '2px solid transparent',
              color: activeTab === tab.id
                ? 'var(--green-ink)'
                : 'color-mix(in oklab, var(--ink) 55%, transparent)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'printers' && <PrintersList />}
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'orderFlow' && <OrderFlowTab />}
    </div>
  );
}
