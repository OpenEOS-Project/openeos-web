'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Edit01, Plus, Tag01, Trash01, X } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useCategories, useDeleteCategory } from '@/hooks/use-categories';
import type { Category } from '@/types/category';

import { CategoryFormModal } from './category-form-modal';

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

  return (
    <>
      <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <ModalOverlay>
          <Modal className="max-w-2xl">
            <Dialog className="w-full">
              <div className="w-full rounded-xl bg-primary shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
                    <p className="text-sm text-tertiary">{t('subtitle')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button iconLeading={Plus} size="sm" onClick={handleCreateClick}>
                      {t('create')}
                    </Button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-tertiary">{tCommon('loading')}</div>
                    </div>
                  ) : !categories || categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
                        <Tag01 className="size-6 text-tertiary" />
                      </div>
                      <h3 className="mt-4 text-sm font-medium text-primary">{t('empty.title')}</h3>
                      <p className="mt-1 text-sm text-tertiary">{t('empty.description')}</p>
                      <Button className="mt-4" iconLeading={Plus} onClick={handleCreateClick}>
                        {t('create')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between rounded-lg border border-secondary p-3 hover:bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex size-10 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: category.color ? `${category.color}20` : undefined,
                              }}
                            >
                              <Tag01
                                className="size-5"
                                style={{ color: category.color || undefined }}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-primary">{category.name}</p>
                              {category.description && (
                                <p className="text-xs text-tertiary line-clamp-1">
                                  {category.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color={category.isActive ? 'success' : 'gray'} size="sm">
                              {t(`status.${category.isActive ? 'active' : 'inactive'}`)}
                            </Badge>
                            <Button
                              color="tertiary"
                              size="sm"
                              iconLeading={Edit01}
                              onClick={() => handleEditClick(category)}
                            />
                            <Button
                              color="tertiary"
                              size="sm"
                              iconLeading={Trash01}
                              className="text-error-primary hover:text-error-primary"
                              onClick={() => handleDeleteClick(category)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-secondary px-6 py-4">
                  <Button color="secondary" onClick={onClose}>
                    {tCommon('close')}
                  </Button>
                </div>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={isFormModalOpen}
        eventId={eventId}
        category={editingCategory}
        onClose={handleFormClose}
      />

      {/* Delete Confirmation */}
      {deletingCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
            <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button color="secondary" onClick={() => setDeletingCategory(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                color="primary-destructive"
                onClick={handleDeleteConfirm}
                isLoading={deleteCategory.isPending}
              >
                {tCommon('delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
