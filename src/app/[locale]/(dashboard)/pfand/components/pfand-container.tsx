'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDeletePfandType } from '@/hooks/use-pfand-types';
import { useAuthStore } from '@/stores/auth-store';
import type { PfandType } from '@/types/pfand';

import { PfandFormModal } from './pfand-form-modal';
import { PfandList } from './pfand-list';
import { PfandSettingsCard } from './pfand-settings-card';

export function PfandContainer() {
  const t = useTranslations('pfand');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<PfandType | null>(null);
  const [deletingType, setDeletingType] = useState<PfandType | null>(null);

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  const deleteType = useDeletePfandType(organizationId);

  const handleDeleteConfirm = async () => {
    if (!deletingType) return;
    try {
      await deleteType.mutateAsync(deletingType.id);
      setDeletingType(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingType(null);
  };

  if (!organizationId) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <h3 className="empty-state__title">Keine Organisation ausgewählt</h3>
          <p className="empty-state__sub">Bitte wählen Sie zuerst eine Organisation aus.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PfandSettingsCard />
        <PfandList
          organizationId={organizationId}
          onCreateClick={() => setIsCreateModalOpen(true)}
          onEditClick={(type) => setEditingType(type)}
          onDeleteClick={(type) => setDeletingType(type)}
        />
      </div>

      <PfandFormModal
        isOpen={isCreateModalOpen || !!editingType}
        organizationId={organizationId}
        pfandType={editingType}
        onClose={handleModalClose}
      />

      {deletingType && (
        <div className="modal__overlay" onClick={() => setDeletingType(null)}>
          <div className="modal__panel" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('deleteConfirm.title')}</h2>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>
                {t('deleteConfirm.message', { name: deletingType.name })}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setDeletingType(null)}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--error, #d24545)' }}
                onClick={handleDeleteConfirm}
                disabled={deleteType.isPending}
              >
                {deleteType.isPending ? '...' : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
