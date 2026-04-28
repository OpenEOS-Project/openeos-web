'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteCategory } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Category } from '@/types/category';
import type { Event } from '@/types/event';

import { CategoryFormModal } from './category-form-modal';
import { CategoriesList } from './categories-list';

function getAvailableEvents(events: Event[] | undefined): Event[] {
  if (!events) return [];
  return events.filter(e => e.status === 'active' || e.status === 'test');
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

  const availableEvents = useMemo(() => getAvailableEvents(events), [events]);

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
      <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tCommon('loading')}</div>
      </div>
    );
  }

  if (availableEvents.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('noEvents.title')}</h3>
          <p className="empty-state__sub">{t('noEvents.description')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Event Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', opacity: 0.7 }}>
          {t('selectEvent')}
        </label>
        <select
          className="select"
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
        <div className="app-card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('selectEventFirst.title')}</h3>
            <p className="empty-state__sub">{t('selectEventFirst.description')}</p>
          </div>
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

          {deletingCategory && (
            <div className="modal__overlay" onClick={() => setDeletingCategory(null)}>
              <div className="modal__panel" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal__head">
                  <h2>{t('deleteConfirm.title')}</h2>
                </div>
                <div className="modal__body">
                  <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>
                    {t('deleteConfirm.message')}
                  </p>
                </div>
                <div className="modal__foot">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setDeletingCategory(null)}
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ background: 'var(--error, #d24545)' }}
                    onClick={handleDeleteConfirm}
                    disabled={deleteCategory.isPending}
                  >
                    {deleteCategory.isPending ? '...' : t('deleteConfirm.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
