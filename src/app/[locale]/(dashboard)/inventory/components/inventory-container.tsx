'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { InventoryCount } from '@/types/inventory';

import { InventoryList } from './inventory-list';
import { InventoryCountView } from './inventory-count-view';
import { CreateInventoryModal } from './create-inventory-modal';

export function InventoryContainer() {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: activeEvent, isLoading: isLoadingActive } = useActiveEvent(organizationId);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null);

  const eventId = activeEvent?.id ?? '';

  if (!organizationId) {
    return (
      <ListEmpty
        title={t('noOrg.title')}
        description={t('noOrg.description')}
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
          </svg>
        }
      />
    );
  }

  if (isLoadingActive) {
    return <ListLoading />;
  }

  if (!activeEvent) {
    return (
      <ListEmpty
        title={t('noEvent.title')}
        description={t('noEvent.description')}
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
        action={
          <Link href="/events" className="btn btn--primary" style={{ marginTop: 12 }}>
            {tCommon('toEvents')}
          </Link>
        }
      />
    );
  }

  if (selectedCount) {
    return (
      <InventoryCountView
        eventId={eventId}
        count={selectedCount}
        onBack={() => setSelectedCount(null)}
        onCountUpdated={(updated) => setSelectedCount(updated)}
      />
    );
  }

  return (
    <>
      <InventoryList
        eventId={eventId}
        onCreateClick={() => setIsCreateModalOpen(true)}
        onSelectCount={(count) => setSelectedCount(count)}
      />

      <CreateInventoryModal
        isOpen={isCreateModalOpen}
        eventId={eventId}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(count) => {
          setIsCreateModalOpen(false);
          setSelectedCount(count);
        }}
      />
    </>
  );
}
