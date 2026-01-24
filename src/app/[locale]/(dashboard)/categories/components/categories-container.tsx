'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useDeleteCategory } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Category } from '@/types/category';
import type { Event } from '@/types/event';

import { CategoryFormModal } from './category-form-modal';
import { CategoriesList } from './categories-list';

// Helper to get available events (not completed/cancelled) sorted by relevance
function getAvailableEvents(events: Event[] | undefined): Event[] {
  if (!events) return [];
  return events
    .filter((e) => e.status !== 'completed' && e.status !== 'cancelled')
    .sort((a, b) => {
      // Active events first, then draft, then by start date
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
}

export function CategoriesContainer() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading: isLoadingEvents } = useEvents(organizationId);
  const deleteCategory = useDeleteCategory();

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

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
  };

  const handleDeleteClick = (category: Category) => {
    setDeletingCategory(category);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory || !selectedEventId) return;

    try {
      await deleteCategory.mutateAsync({ eventId: selectedEventId, id: deletingCategory.id });
      setDeletingCategory(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingCategory(null);
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
          title={t('noEvents.title')}
          description={t('noEvents.description')}
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
              {event.name} {event.status === 'active' ? '(Aktiv)' : event.status === 'draft' ? '(Entwurf)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedEventId ? (
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="calendar"
            title={t('selectEventFirst.title')}
            description={t('selectEventFirst.description')}
          />
        </div>
      ) : (
        <>
          <CategoriesList
            eventId={selectedEventId}
            onCreateClick={handleCreateClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />

          <CategoryFormModal
            isOpen={isCreateModalOpen || !!editingCategory}
            eventId={selectedEventId}
            category={editingCategory}
            onClose={handleModalClose}
          />

          {/* Delete confirmation modal */}
          {deletingCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
              <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
                <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    color="secondary"
                    onClick={() => setDeletingCategory(null)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    color="primary-destructive"
                    onClick={handleDeleteConfirm}
                    isLoading={deleteCategory.isPending}
                    isDisabled={deleteCategory.isPending}
                  >
                    {t('deleteConfirm.confirm')}
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
