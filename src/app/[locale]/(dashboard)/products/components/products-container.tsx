'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Tag01 } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useDeleteProduct } from '@/hooks/use-products';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Product } from '@/types/product';
import type { Event } from '@/types/event';

import { ProductFormModal } from './product-form-modal';
import { ProductsList } from './products-list';
import { StockAdjustmentModal } from './stock-adjustment-modal';
import { CategoriesManagementModal } from './categories-management-modal';

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

export function ProductsContainer() {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const { data: events, isLoading: isLoadingEvents } = useEvents(organizationId);
  const deleteProduct = useDeleteProduct();

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
    if (!deletingProduct || !selectedEventId) return;

    try {
      await deleteProduct.mutateAsync({ eventId: selectedEventId, id: deletingProduct.id });
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
      {/* Event Selector & Categories Button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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
        {selectedEventId && (
          <Button
            color="secondary"
            size="sm"
            iconLeading={Tag01}
            onClick={() => setIsCategoriesModalOpen(true)}
          >
            {t('manageCategories')}
          </Button>
        )}
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
          <ProductsList
            eventId={selectedEventId}
            onCreateClick={handleCreateClick}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onAdjustStockClick={handleAdjustStockClick}
          />

          <ProductFormModal
            isOpen={isCreateModalOpen || !!editingProduct}
            eventId={selectedEventId}
            product={editingProduct}
            onClose={handleModalClose}
          />

          <StockAdjustmentModal
            isOpen={!!adjustingStockProduct}
            eventId={selectedEventId}
            product={adjustingStockProduct}
            onClose={() => setAdjustingStockProduct(null)}
          />

          {/* Delete confirmation modal */}
          {deletingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
              <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
                <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    color="secondary"
                    onClick={() => setDeletingProduct(null)}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    color="primary-destructive"
                    onClick={handleDeleteConfirm}
                    isLoading={deleteProduct.isPending}
                    isDisabled={deleteProduct.isPending}
                  >
                    {t('deleteConfirm.confirm')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Categories Management Modal */}
      <CategoriesManagementModal
        isOpen={isCategoriesModalOpen}
        eventId={selectedEventId}
        onClose={() => setIsCategoriesModalOpen(false)}
      />
    </>
  );
}
