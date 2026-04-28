'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HardwareList } from './hardware-list';
import { AssignmentsList } from './assignments-list';

export function RentalHardwareContainer() {
  const t = useTranslations('admin.rental');
  const [activeTab, setActiveTab] = useState<'hardware' | 'assignments'>('hardware');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', paddingBottom: 0 }}>
        {(['hardware', 'assignments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--green-ink)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab === 'hardware' ? t('hardware.title') : t('assignments.title')}
          </button>
        ))}
      </div>

      {activeTab === 'hardware' && <HardwareList />}
      {activeTab === 'assignments' && <AssignmentsList />}
    </div>
  );
}
