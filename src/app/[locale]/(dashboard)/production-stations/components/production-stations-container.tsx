'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Building } from 'lucide-react';
import { Icon } from '@openeos/ui';

import { useDeleteProductionStation } from '@/hooks/use-production-stations';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { ProductionStation } from '@/types/production-station';
import { ListEmpty } from '@/components/shared/list-states';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';

import { ProductionStationFormModal } from './production-station-form-modal';
import { ProductionStationsList } from './production-stations-list';

export function ProductionStationsContainer() {
  const t = useTranslations('productionStations');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<ProductionStation | null>(null);
  const [deletingStation, setDeletingStation] = useState<ProductionStation | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: activeEvent, isLoading: isLoadingActive } = useActiveEvent(organizationId);
  const deleteStation = useDeleteProductionStation();

  const eventId = activeEvent?.id ?? '';

  const handleDeleteConfirm = async () => {
    if (!deletingStation || !eventId) return;
    try {
      await deleteStation.mutateAsync({ eventId, id: deletingStation.id });
      setDeletingStation(null);
    } catch {
      // Error handled by mutation
    }
  };

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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
          animation: 'spin 0.75s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="calendar" size={28} />
        }
        action={
          <Link href="/events" className="btn btn--primary">
            {tCommon('toEvents')}
          </Link>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ProductionStationsList
        eventId={eventId}
        onCreateClick={() => setIsCreateModalOpen(true)}
        onEditClick={(station) => setEditingStation(station)}
        onDeleteClick={(station) => setDeletingStation(station)}
      />

      <ProductionStationFormModal
        isOpen={isCreateModalOpen || !!editingStation}
        eventId={eventId}
        organizationId={organizationId}
        station={editingStation}
        onClose={() => { setIsCreateModalOpen(false); setEditingStation(null); }}
      />

      {deletingStation && (
        <div className="modal__overlay" onClick={() => setDeletingStation(null)}>
          <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('deleteConfirm.title')}</h2>
              <DialogCloseButton onClick={() => setDeletingStation(null)} />
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                {t('deleteConfirm.message')}
              </p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeletingStation(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleDeleteConfirm}
                disabled={deleteStation.isPending}
              >
                {deleteStation.isPending ? tCommon('saving') : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
