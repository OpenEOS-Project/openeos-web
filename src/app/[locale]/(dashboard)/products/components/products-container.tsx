'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { useDeleteProduct } from '@/hooks/use-products';
import { useActiveEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { Product } from '@/types/product';

import { ProductFormModal } from './product-form-modal';
import { ProductImportModal } from './product-import-modal';
import { ProductsList } from './products-list';
import { StockAdjustmentModal } from './stock-adjustment-modal';

export function ProductsContainer() {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: activeEvent, isLoading: isLoadingActive } = useActiveEvent(organizationId);
  const deleteProduct = useDeleteProduct();

  const eventId = activeEvent?.id ?? '';

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
  };

  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product);
  };

  const handleAdjustStockClick = (product: Product) => {
    setAdjustingStockProduct(product);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct || !eventId) return;

    try {
      await deleteProduct.mutateAsync({ eventId, id: deletingProduct.id });
      setDeletingProduct(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingProduct(null);
  };

  if (!organizationId) {
    return (
      <ListEmpty
        title="Keine Organisation ausgewählt"
        description="Bitte wählen Sie zuerst eine Organisation aus."
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
          </svg>
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
        action={
          <Link href="/events" className="btn btn--primary" style={{ marginTop: 12 }}>
            {t('noEvents.goToEvents')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ProductsList
        eventId={eventId}
        onCreateClick={handleCreateClick}
        onImportClick={() => setIsImportModalOpen(true)}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onAdjustStockClick={handleAdjustStockClick}
      />

      <ProductImportModal
        isOpen={isImportModalOpen}
        eventId={eventId}
        onClose={() => setIsImportModalOpen(false)}
      />

      <ProductFormModal
        isOpen={isCreateModalOpen || !!editingProduct}
        eventId={eventId}
        product={editingProduct}
        onClose={handleModalClose}
      />

      <StockAdjustmentModal
        isOpen={!!adjustingStockProduct}
        eventId={eventId}
        product={adjustingStockProduct}
        onClose={() => setAdjustingStockProduct(null)}
      />

      {deletingProduct && (
        <div className="modal__overlay" onClick={() => setDeletingProduct(null)}>
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
                onClick={() => setDeletingProduct(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--error, var(--danger))' }}
                onClick={handleDeleteConfirm}
                disabled={deleteProduct.isPending}
              >
                {deleteProduct.isPending ? tCommon('deleting') : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
