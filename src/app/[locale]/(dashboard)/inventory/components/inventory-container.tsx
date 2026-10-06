'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building } from 'lucide-react';
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
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={
          <Building size={28} />
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
          <Icon name="calendar" size={28} />
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
