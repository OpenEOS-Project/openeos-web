'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/stores/auth-store';
import { useRemoveMember } from '@/hooks/use-members';
import type { UserOrganization } from '@/types/auth';

import { InviteMemberModal } from './invite-member-modal';
import { MembersList } from './members-list';

export function MembersContainer() {
  const t = useTranslations('members');
  const { currentOrganization } = useAuthStore();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<UserOrganization | null>(null);

  const organizationId = currentOrganization?.organizationId;
  const removeMember = useRemoveMember(organizationId || '');

  const handleInviteClick = () => {
    setIsInviteModalOpen(true);
  };

  const handleRemoveClick = (member: UserOrganization) => {
    setRemovingMember(member);
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
      <div className="rounded-xl border border-secondary bg-primary p-6 text-center">
        <p className="text-tertiary">Keine Organisation ausgewählt</p>
      </div>
    );
  }

  return (
    <>
      <MembersList
        organizationId={organizationId}
        onInviteClick={handleInviteClick}
        onRemoveClick={handleRemoveClick}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        organizationId={organizationId}
        onClose={handleModalClose}
      />

      {/* Remove confirmation modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-xl bg-primary p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-primary">{t('removeConfirm.title')}</h3>
            <p className="mt-2 text-sm text-tertiary">{t('removeConfirm.message')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary"
                onClick={() => setRemovingMember(null)}
              >
                {t('removeConfirm.message', { ns: 'common' })}
              </button>
              <button
                type="button"
                className="rounded-lg bg-error-solid px-4 py-2 text-sm font-medium text-white hover:bg-error-solid_hover"
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
