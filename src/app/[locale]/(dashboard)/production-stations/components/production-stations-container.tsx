'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useDeleteProductionStation } from '@/hooks/use-production-stations';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { ProductionStation } from '@/types/production-station';
import type { Event } from '@/types/event';

import { ProductionStationFormModal } from './production-station-form-modal';
import { ProductionStationsList } from './production-stations-list';
import { StationFlowDiagram } from './station-flow-diagram';
import { StationLivePreview } from './station-live-preview';

// Helper to get available events (active or test) sorted by relevance
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

  // Get available events (not completed/cancelled)
  const availableEvents = useMemo(() => getAvailableEvents(events), [events]);

  // Auto-select first available event when events load
  useEffect(() => {
    if (availableEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(availableEvents[0].id);
    }
  }, [availableEvents, selectedEventId]);

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (station: ProductionStation) => {
    setEditingStation(station);
  };

  const handleDeleteClick = (station: ProductionStation) => {
    setDeletingStation(station);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingStation || !selectedEventId) return;

    try {
      await deleteStation.mutateAsync({ eventId: selectedEventId, id: deletingStation.id });
      setDeletingStation(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingStation(null);
  };

  if (!organizationId) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="building"
          title="Keine Organisation ausgewählt"
          description="Bitte wählen Sie zuerst eine Organisation aus."
        />
      </div>
    );
  }

  if (isLoadingEvents) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (availableEvents.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="calendar"
          title={t('empty.title')}
          description={t('empty.description')}
        />
      </div>
    );
  }

  return (
    <>
      {/* Event Selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-tertiary" />
          <label className="text-sm font-medium text-secondary">{t('selectEvent')}</label>
        </div>
        <select
          className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          {availableEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} {event.status === 'active' ? '(Aktiv)' : event.status === 'test' ? '(Test)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedEventId ? (
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="calendar"
            title={t('selectEvent')}
            description={t('empty.description')}
          />
        </div>
      ) : (
        <>
          <StationFlowDiagram eventId={selectedEventId} />

          <StationLivePreview eventId={selectedEventId} organizationId={organizationId} />

          <ProductionStationsList
            eventId={selectedEventId}
            onCreateClick={handleCreateClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />

          <ProductionStationFormModal
            isOpen={isCreateModalOpen || !!editingStation}
            eventId={selectedEventId}
            organizationId={organizationId}
            station={editingStation}
            onClose={handleModalClose}
          />

          {/* Delete confirmation modal */}
          {deletingStation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
              <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
                <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    color="secondary"
                    onClick={() => setDeletingStation(null)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    color="primary-destructive"
                    onClick={handleDeleteConfirm}
                    isLoading={deleteStation.isPending}
                    isDisabled={deleteStation.isPending}
                  >
                    {tCommon('delete')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
