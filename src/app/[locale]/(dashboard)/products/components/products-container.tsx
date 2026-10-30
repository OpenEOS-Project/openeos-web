'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { Building } from 'lucide-react';
import Link from 'next/link';

import { useAssistantStatus } from '@/hooks/use-assistant';
import { useDeleteProduct } from '@/hooks/use-products';
import { useActiveEvent } from '@/hooks/use-events';
import { usePermissions } from '@/hooks/use-permissions';
import { assistantUsable } from '@/lib/assistant';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { Product } from '@/types/product';

import { CategoriesManagementModal } from './categories-management-modal';
import { ImportDialog } from './import-dialog';
import { ProductFormModal } from './product-form-modal';
import { ProductsList } from './products-list';
import { StockAdjustmentModal } from './stock-adjustment-modal';

export function ProductsContainer() {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: activeEvent, isLoading: isLoadingActive } = useActiveEvent(organizationId);
  const deleteProduct = useDeleteProduct();
  /* Der Reiter „Speisekarte“ im Import-Dialog nur mit eingeschalteten
     Assistent-Funktionen; Admins sehen sonst einen Hinweis auf die
     Einstellung — aber nur, wenn der Server die Funktionen überhaupt anbietet. */
  const { data: assistant } = useAssistantStatus(organizationId || undefined);
  const { isAdmin } = usePermissions();
  const menuImportAvailable = assistantUsable(assistant);
  const menuImportHint = !!assistant?.available && !assistant.enabled && isAdmin;

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
      <ProductsList
        eventId={eventId}
        onCreateClick={handleCreateClick}
        onImportClick={() => setIsImportOpen(true)}
        menuImportHint={menuImportHint}
        onManageCategoriesClick={() => setIsCategoriesModalOpen(true)}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onAdjustStockClick={handleAdjustStockClick}
      />

      <CategoriesManagementModal
        isOpen={isCategoriesModalOpen}
        eventId={eventId}
        onClose={() => setIsCategoriesModalOpen(false)}
      />

      {/* Nur eingehängt, solange er offen ist: jedes Öffnen startet frisch. */}
      {isImportOpen && (
        <ImportDialog
          eventId={eventId}
          menuAvailable={menuImportAvailable}
          onClose={() => setIsImportOpen(false)}
        />
      )}

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
