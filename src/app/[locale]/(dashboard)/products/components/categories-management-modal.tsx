'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useCategories, useDeleteCategory, useReorderCategories } from '@/hooks/use-categories';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { Category } from '@/types/category';

import { CategoryFormModal } from '@/components/shared/category-form-modal';
import { CategorySortableRow } from './category-sortable-row';

interface CategoriesManagementModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
}

export function CategoriesManagementModal({
  isOpen,
  eventId,
  onClose,
}: CategoriesManagementModalProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const { data: categories, isLoading } = useCategories(eventId);
  const deleteCategory = useDeleteCategory();
  const reorderCategories = useReorderCategories();

  /* Die Reihenfolge liegt waehrend des Ziehens lokal, damit die Zeile
     sofort an ihrem neuen Platz steht. Der Server wird danach informiert;
     kommt seine Antwort, uebernimmt wieder seine Reihenfolge. */
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    if (categories) setOrder(categories.map((c) => c.id));
  }, [categories]);

  const sensors = useSensors(
    /* Erst ab acht Pixeln gilt es als Ziehen — sonst waere schon ein Druck
       auf den Griff eine Verschiebung. */
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = order
    .map((id) => categories?.find((c) => c.id === id))
    .filter((c): c is Category => !!c);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const next = arrayMove(order, from, to);
    setOrder(next);
    reorderCategories.mutate({ eventId, categoryIds: next });
  };

  const handleCreateClick = () => {
    setEditingCategory(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setDeletingCategory(category);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync({ eventId, id: deletingCategory.id });
      setDeletingCategory(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleFormClose = () => {
    setIsFormModalOpen(false);
    setEditingCategory(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal__overlay" onClick={onClose}>
        <div className="modal__panel modal__panel--lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <div>
              <h2>{t('title')}</h2>
              <div style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.55, marginTop: 2 }}>{t('subtitle')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="btn btn--primary" style={{ fontSize: 13 }} onClick={handleCreateClick}>
                + {t('create')}
              </button>
              <DialogCloseButton onClick={onClose} />
            </div>
          </div>

          <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tCommon('loading')}</div>
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <h3 className="empty-state__title">{t('empty.title')}</h3>
                <p className="empty-state__sub">{t('empty.description')}</p>
                <button className="btn btn--primary" onClick={handleCreateClick}>
                  {t('create')}
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  <div className="cat-list">
                    {sorted.map((category) => (
                      <CategorySortableRow
                        key={category.id}
                        category={category}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        editLabel={tCommon('edit')}
                        deleteLabel={tCommon('delete')}
                        statusLabel={t('status.inactive')}
                        dragLabel={t('reorder.handle')}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <p className="cat-list__hint">{t('reorder.hint')}</p>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {tCommon('close')}
            </button>
          </div>
        </div>
      </div>

      <CategoryFormModal
        isOpen={isFormModalOpen}
        eventId={eventId}
        category={editingCategory}
        onClose={handleFormClose}
      />

      {deletingCategory && (
        <div className="modal__overlay" style={{ zIndex: 60 }} onClick={() => setDeletingCategory(null)}>
          <div className="modal__panel modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('deleteConfirm.title')}</h2>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>
                {t('deleteConfirm.message')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setDeletingCategory(null)}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--danger)' }}
                onClick={handleDeleteConfirm}
                disabled={deleteCategory.isPending}
              >
                {deleteCategory.isPending ? tCommon('deleting') : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
