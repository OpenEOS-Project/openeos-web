'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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

  if (!isOpen) return null;

  return (
    <>
      <div className="modal__overlay" onClick={onClose}>
        <div className="modal__panel" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <div>
              <h2>{t('title')}</h2>
              <div style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.55, marginTop: 2 }}>{t('subtitle')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="btn btn--primary" style={{ fontSize: 13 }} onClick={handleCreateClick}>
                + {t('create')}
              </button>
              <button type="button" className="modal__close" onClick={onClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                      borderRadius: 10, padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: category.color ? `${category.color}20` : 'color-mix(in oklab, var(--ink) 8%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={category.color || 'currentColor'} strokeWidth="2">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{category.name}</div>
                        {category.description && (
                          <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                            {category.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={category.isActive ? 'badge badge--success' : 'badge badge--neutral'}>
                        {t(`status.${category.isActive ? 'active' : 'inactive'}`)}
                      </span>
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleEditClick(category)}>
                        {tCommon('edit') ?? 'Edit'}
                      </button>
                      <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12, color: '#d24545' }} onClick={() => handleDeleteClick(category)}>
                        {tCommon('delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <button type="button" className="btn btn--ghost" onClick={() => setDeletingCategory(null)}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: '#d24545' }}
                onClick={handleDeleteConfirm}
                disabled={deleteCategory.isPending}
              >
                {deleteCategory.isPending ? '...' : tCommon('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
