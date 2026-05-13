'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { useDeleteProductionStation } from '@/hooks/use-production-stations';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { ProductionStation } from '@/types/production-station';

import { ProductionStationFormModal } from './production-station-form-modal';
import { ProductionStationsList } from './production-stations-list';
import { StationFlowDiagram } from './station-flow-diagram';
import { StationLivePreview } from './station-live-preview';

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
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
          </div>
          <h3 className="empty-state__title">Keine Organisation ausgewählt</h3>
          <p className="empty-state__sub">Bitte wählen Sie zuerst eine Organisation aus.</p>
        </div>
      </div>
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
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <Link href="/events" className="btn btn--primary" style={{ marginTop: 12 }}>
            {tCommon('toEvents')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <StationFlowDiagram eventId={eventId} />

      <StationLivePreview eventId={eventId} organizationId={organizationId} />

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
              <button
                className="modal__close"
                type="button"
                onClick={() => setDeletingStation(null)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
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
                style={{ background: '#d24545', borderColor: '#d24545' }}
                onClick={handleDeleteConfirm}
                disabled={deleteStation.isPending}
              >
                {deleteStation.isPending ? '...' : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
