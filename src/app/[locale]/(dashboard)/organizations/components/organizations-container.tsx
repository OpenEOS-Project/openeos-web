'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useDeleteOrganization } from '@/hooks/use-organizations';
import type { Organization } from '@/types';

import { CreditsModal } from './credits-modal';
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
  const [creditsOrganization, setCreditsOrganization] = useState<Organization | null>(null);

  const deleteOrganization = useDeleteOrganization();

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (organization: Organization) => {
    setEditingOrganization(organization);
  };

  const handleDeleteClick = (organization: Organization) => {
    setDeletingOrganization(organization);
  };

  const handleManageMembersClick = (organization: Organization) => {
    setMembersOrganization(organization);
  };

  const handleManageCreditsClick = (organization: Organization) => {
    setCreditsOrganization(organization);
  };

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
        onManageCreditsClick={handleManageCreditsClick}
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

      <CreditsModal
        isOpen={!!creditsOrganization}
        organization={creditsOrganization}
        onClose={() => setCreditsOrganization(null)}
      />

      {/* Delete confirmation modal */}
      {deletingOrganization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t('deleteConfirm.title')}</h3>
            <p className="mt-2 text-sm text-tertiary">{t('deleteConfirm.message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary"
                onClick={() => setDeletingOrganization(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-error-solid px-4 py-2 text-sm font-medium text-white hover:bg-error-solid_hover"
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
