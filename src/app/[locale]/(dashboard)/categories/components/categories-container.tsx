'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building } from 'lucide-react';
import Link from 'next/link';

import { useDeleteCategory } from '@/hooks/use-categories';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { Category } from '@/types/category';

import { CategoryFormModal } from '@/components/shared/category-form-modal';
import { CategoriesList } from './categories-list';

export function CategoriesContainer() {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: activeEvent, isLoading: isLoadingActive } = useActiveEvent(organizationId);
  const deleteCategory = useDeleteCategory();

  const eventId = activeEvent?.id ?? '';

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
    if (!deletingCategory || !eventId) return;

    try {
      await deleteCategory.mutateAsync({ eventId, id: deletingCategory.id });
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
        title={t('noEvents.title')}
        description={t('noEvents.description')}
        icon={
          <Icon name="calendar" size={28} />
        }
        action={
          <Link href="/events" className="btn btn--primary">
            {t('noEvents.goToEvents')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <CategoriesList
        eventId={eventId}
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <CategoryFormModal
        isOpen={isCreateModalOpen || !!editingCategory}
        eventId={eventId}
        category={editingCategory}
        onClose={handleModalClose}
      />

      {deletingCategory && (
        <div className="modal__overlay" onClick={() => setDeletingCategory(null)}>
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
                style={{ background: 'var(--error, var(--danger))' }}
                onClick={handleDeleteConfirm}
                disabled={deleteCategory.isPending}
              >
                {deleteCategory.isPending ? tCommon('deleting') : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
