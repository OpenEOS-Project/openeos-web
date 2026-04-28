'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/buttons/button';
import {
  useActivateEvent,
  useDeactivateEvent,
  useSetTestMode,
  useDeleteEvent,
} from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Event } from '@/types';

import { EventFormModal } from './event-form-modal';
import { EventsList } from './events-list';

export function EventsContainer() {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const deleteEvent = useDeleteEvent();
  const activateEvent = useActivateEvent();
  const deactivateEvent = useDeactivateEvent();
  const setTestMode = useSetTestMode();

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (event: Event) => {
    setEditingEvent(event);
  };

  const handleDeleteClick = (event: Event) => {
    setDeletingEvent(event);
  };

  const handleActivateClick = async (event: Event) => {
    if (!organizationId) return;
    try {
      await activateEvent.mutateAsync({ organizationId, id: event.id });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeactivateClick = async (event: Event) => {
    if (!organizationId) return;
    try {
      await deactivateEvent.mutateAsync({ organizationId, id: event.id });
    } catch {
      // Error handled by mutation
    }
  };

  const handleSetTestModeClick = async (event: Event) => {
    if (!organizationId) return;
    try {
      await setTestMode.mutateAsync({ organizationId, id: event.id });
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent || !organizationId) return;

    try {
      await deleteEvent.mutateAsync({ organizationId, id: deletingEvent.id });
      setDeletingEvent(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingEvent(null);
  };

  return (
    <>
      <EventsList
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onActivateClick={handleActivateClick}
        onDeactivateClick={handleDeactivateClick}
        onSetTestModeClick={handleSetTestModeClick}
      />

      <EventFormModal
        isOpen={isCreateModalOpen || !!editingEvent}
        event={editingEvent}
        onClose={handleModalClose}
      />

      {/* Delete confirmation modal */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
            <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                color="secondary"
                onClick={() => setDeletingEvent(null)}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                color="primary-destructive"
                onClick={handleDeleteConfirm}
                isLoading={deleteEvent.isPending}
                isDisabled={deleteEvent.isPending}
              >
                {t('deleteConfirm.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
