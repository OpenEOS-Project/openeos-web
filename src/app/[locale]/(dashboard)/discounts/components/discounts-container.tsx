'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteDiscountVoucher } from '@/hooks/use-discount-vouchers';
import { useAuthStore } from '@/stores/auth-store';
import { ListEmpty } from '@/components/shared/list-states';
import type { DiscountVoucher } from '@/types/discount-voucher';

import { DiscountFormModal } from './discount-form-modal';
import { DiscountsList } from './discounts-list';

export function DiscountsContainer() {
  const t = useTranslations('discounts');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<DiscountVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] = useState<DiscountVoucher | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const deleteVoucher = useDeleteDiscountVoucher(organizationId);

  const handleDeleteConfirm = async () => {
    if (!deletingVoucher) return;
    try {
      await deleteVoucher.mutateAsync(deletingVoucher.id);
      setDeletingVoucher(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingVoucher(null);
  };

  if (!organizationId) {
    return (
      <ListEmpty
        title="Keine Organisation ausgewählt"
        description="Bitte wählen Sie zuerst eine Organisation aus."
      />
    );
  }

  return (
    <>
      <DiscountsList
        organizationId={organizationId}
        onCreateClick={() => setIsCreateModalOpen(true)}
        onEditClick={(voucher) => setEditingVoucher(voucher)}
        onDeleteClick={(voucher) => setDeletingVoucher(voucher)}
      />

      <DiscountFormModal
        isOpen={isCreateModalOpen || !!editingVoucher}
        organizationId={organizationId}
        voucher={editingVoucher}
        onClose={handleModalClose}
      />

      {deletingVoucher && (
        <div className="modal__overlay" onClick={() => setDeletingVoucher(null)}>
          <div className="modal__panel modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('deleteConfirm.title')}</h2>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>
                {t('deleteConfirm.message', { name: deletingVoucher.name })}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setDeletingVoucher(null)}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--error, var(--danger))' }}
                onClick={handleDeleteConfirm}
                disabled={deleteVoucher.isPending}
              >
                {deleteVoucher.isPending ? tCommon('saving') : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
