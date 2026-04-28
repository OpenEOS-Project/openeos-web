'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/stores/auth-store';
import { useRemoveMember } from '@/hooks/use-members';
import type { UserOrganization } from '@/types/auth';

import { EditPermissionsModal } from './edit-permissions-modal';
import { InvitationsList } from './invitations-list';
import { InviteMemberModal } from './invite-member-modal';
import { MembersList } from './members-list';

export function MembersContainer() {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<UserOrganization | null>(null);
  const [editingMember, setEditingMember] = useState<UserOrganization | null>(null);

  const organizationId = currentOrganization?.organizationId;
  const removeMember = useRemoveMember(organizationId || '');

  const handleInviteClick = () => {
    setIsInviteModalOpen(true);
  };

  const handleRemoveClick = (member: UserOrganization) => {
    setRemovingMember(member);
  };

  const handleEditPermissionsClick = (member: UserOrganization) => {
    setEditingMember(member);
  };

  const handleRemoveConfirm = async () => {
    if (!removingMember) return;

    try {
      await removeMember.mutateAsync(removingMember.userId);
      setRemovingMember(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleModalClose = () => {
    setIsInviteModalOpen(false);
  };

  if (!organizationId) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="empty-state__title">Keine Organisation ausgewählt</h3>
          <p className="empty-state__sub">Bitte wählen Sie zuerst eine Organisation aus.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MembersList
        organizationId={organizationId}
        onInviteClick={handleInviteClick}
        onRemoveClick={handleRemoveClick}
        onEditPermissionsClick={handleEditPermissionsClick}
      />

      <InvitationsList organizationId={organizationId} />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        organizationId={organizationId}
        onClose={handleModalClose}
      />

      {editingMember && (
        <EditPermissionsModal
          isOpen={!!editingMember}
          organizationId={organizationId}
          member={editingMember as UserOrganization & { user?: { firstName: string; lastName: string; email: string } }}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* Remove confirmation modal */}
      {removingMember && (
        <div className="modal__overlay" style={{ display: 'flex' }}>
          <div className="modal__panel" style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <h3 className="modal__title">{t('removeConfirm.title')}</h3>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink-faint)', margin: 0 }}>{t('removeConfirm.message')}</p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setRemovingMember(null)}
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--red, #dc2626)', color: '#fff' }}
                onClick={handleRemoveConfirm}
                disabled={removeMember.isPending}
              >
                {removeMember.isPending ? '...' : t('removeConfirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
