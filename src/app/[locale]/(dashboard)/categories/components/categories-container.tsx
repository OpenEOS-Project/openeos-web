'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building } from 'lucide-react';
import Link from 'next/link';

import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { Category } from '@/types/category';

import { CategoryFormModal } from '@/components/shared/category-form-modal';
import { CategoryDeleteDialog } from '@/components/shared/category-delete-dialog';
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
        <CategoryDeleteDialog
          eventId={eventId}
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
        />
      )}
    </>
  );
}
