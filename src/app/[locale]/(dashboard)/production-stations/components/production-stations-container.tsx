'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteProductionStation } from '@/hooks/use-production-stations';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { ProductionStation } from '@/types/production-station';
import type { Event } from '@/types/event';

import { ProductionStationFormModal } from './production-station-form-modal';
import { ProductionStationsList } from './production-stations-list';
import { StationFlowDiagram } from './station-flow-diagram';
import { StationLivePreview } from './station-live-preview';

function getAvailableEvents(events: Event[] | undefined): Event[] {
  if (!events) return [];
  return events.filter(e => e.status === 'active' || e.status === 'test');
}

export function ProductionStationsContainer() {
  const t = useTranslations('productionStations');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<ProductionStation | null>(null);
  const [deletingStation, setDeletingStation] = useState<ProductionStation | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading: isLoadingEvents } = useEvents(organizationId);
  const deleteStation = useDeleteProductionStation();

  const availableEvents = useMemo(() => getAvailableEvents(events), [events]);

  useEffect(() => {
    if (availableEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(availableEvents[0].id);
    }
  }, [availableEvents, selectedEventId]);

  const handleDeleteConfirm = async () => {
    if (!deletingStation || !selectedEventId) return;
    try {
      await deleteStation.mutateAsync({ eventId: selectedEventId, id: deletingStation.id });
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

  if (isLoadingEvents) {
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

  if (availableEvents.length === 0) {
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
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Event Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', whiteSpace: 'nowrap' }}>
          {t('selectEvent')}
        </label>
        <select
          className="select"
          style={{ maxWidth: 320 }}
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          {availableEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}{event.status === 'active' ? ' (Aktiv)' : event.status === 'test' ? ' (Test)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedEventId ? (
        <div className="app-card">
          <div className="empty-state">
            <h3 className="empty-state__title">{t('selectEvent')}</h3>
            <p className="empty-state__sub">{t('empty.description')}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <StationFlowDiagram eventId={selectedEventId} />

          <StationLivePreview eventId={selectedEventId} organizationId={organizationId} />

          <ProductionStationsList
            eventId={selectedEventId}
            onCreateClick={() => setIsCreateModalOpen(true)}
            onEditClick={(station) => setEditingStation(station)}
            onDeleteClick={(station) => setDeletingStation(station)}
          />

          <ProductionStationFormModal
            isOpen={isCreateModalOpen || !!editingStation}
            eventId={selectedEventId}
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
      )}
    </>
  );
}
