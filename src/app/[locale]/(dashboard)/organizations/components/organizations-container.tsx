'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteOrganization } from '@/hooks/use-organizations';
import type { Organization } from '@/types';

import { MembersModal } from './members-modal';
import { OrganizationFormModal } from './organization-form-modal';
import { OrganizationsList } from './organizations-list';

export function OrganizationsContainer() {
  const t = useTranslations('organizations');
  const tCommon = useTranslations('common');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [deletingOrganization, setDeletingOrganization] = useState<Organization | null>(null);
  const [membersOrganization, setMembersOrganization] = useState<Organization | null>(null);

  const deleteOrganization = useDeleteOrganization();

  const handleCreateClick = () => setIsCreateModalOpen(true);
  const handleEditClick = (organization: Organization) => setEditingOrganization(organization);
  const handleDeleteClick = (organization: Organization) => setDeletingOrganization(organization);
  const handleManageMembersClick = (organization: Organization) => setMembersOrganization(organization);

  const handleDeleteConfirm = async () => {
    if (!deletingOrganization) return;
    try {
      await deleteOrganization.mutateAsync(deletingOrganization.id);
      setDeletingOrganization(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingOrganization(null);
  };

  return (
    <>
      <OrganizationsList
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onManageMembersClick={handleManageMembersClick}
      />

      <OrganizationFormModal
        isOpen={isCreateModalOpen || !!editingOrganization}
        organization={editingOrganization}
        onClose={handleModalClose}
      />

      <MembersModal
        isOpen={!!membersOrganization}
        organization={membersOrganization}
        onClose={() => setMembersOrganization(null)}
      />

      {/* Delete confirmation modal */}
      {deletingOrganization && (
        <div className="modal__overlay" style={{ display: 'flex' }}>
          <div className="modal__panel" style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <h3 className="modal__title">{t('deleteConfirm.title')}</h3>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink-faint)', margin: 0 }}>{t('deleteConfirm.message')}</p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeletingOrganization(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--red, #dc2626)', color: '#fff' }}
                onClick={handleDeleteConfirm}
                disabled={deleteOrganization.isPending}
              >
                {deleteOrganization.isPending ? '...' : t('deleteConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
