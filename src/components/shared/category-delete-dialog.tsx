'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteCategory } from '@/hooks/use-categories';
import { useProducts } from '@/hooks/use-products';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { Link } from '@/i18n/routing';
import type { Category } from '@/types/category';

/**
 * Kategorie löschen.
 *
 * Die API löscht nur leere Kategorien (409 CATEGORY_HAS_PRODUCTS) — eine
 * Standardkategorie, in die Produkte wandern könnten, gibt es nicht. Früher
 * versprach der Dialog genau das und scheiterte dann. Jetzt zählt er die
 * Produkte vorher: mit Produkten gibt es statt „Löschen“ den Weg zu genau
 * diesen Produkten, leer wird endgültig gelöscht.
 */
export function CategoryDeleteDialog({
  eventId,
  category,
  onClose,
  onShowProducts,
  zIndex,
}: {
  eventId: string;
  category: Category;
  onClose: () => void;
  /** Auf der Produktseite: Filter setzen statt neu zu navigieren. */
  onShowProducts?: (categoryId: string) => void;
  zIndex?: number;
}) {
  const t = useTranslations('categories.deleteConfirm');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const deleteCategory = useDeleteCategory();
  const { data: products, isLoading } = useProducts(eventId);
  const [error, setError] = useState<string | null>(null);

  const count = (products ?? []).filter((p) => p.categoryId === category.id).length;
  const blocked = count > 0;
  const productsHref = `/products?category=${encodeURIComponent(category.id)}`;

  const confirm = async () => {
    setError(null);
    try {
      await deleteCategory.mutateAsync({ eventId, id: category.id });
      onClose();
    } catch (err) {
      // z. B. CATEGORY_HAS_PRODUCTS, wenn gerade jemand ein Produkt anlegte.
      setError(apiErrorMessage(err, tCommon('error')));
    }
  };

  return (
    <div className="modal__overlay" style={zIndex ? { zIndex } : undefined} onClick={onClose}>
      <div
        className="modal__panel modal__panel--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-delete-title"
        data-testid="category-delete-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="category-delete-title">{t('title')}</h2>
        </div>
        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7, margin: 0 }}>
            {blocked
              ? t('hasProducts', { name: category.name, count })
              : t('message', { name: category.name })}
          </p>
          {blocked && (
            <p style={{ margin: 0, fontSize: 14 }}>
              {onShowProducts ? (
                <button
                  type="button"
                  className="notice-link"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  onClick={() => onShowProducts(category.id)}
                >
                  {t('showProducts', { count })}
                </button>
              ) : (
                <Link href={productsHref} className="notice-link">
                  {t('showProducts', { count })}
                </Link>
              )}
            </p>
          )}
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
              {error}
            </p>
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {blocked ? tCommon('close') : tCommon('cancel')}
          </button>
          {!blocked && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ background: 'var(--error, var(--danger))' }}
              onClick={() => void confirm()}
              disabled={isLoading || deleteCategory.isPending}
            >
              {deleteCategory.isPending ? tCommon('deleting') : t('confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
