'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { useMembers, useCreateInvitation, useRemoveMember, useUpdateMember, useInvitations, useDeleteInvitation } from '@/hooks/use-members';
import type { Organization } from '@/types/organization';
import type { OrganizationRole, UserOrganization } from '@/types/auth';

interface MembersModalProps {
  isOpen: boolean;
  organization: Organization | null;
  onClose: () => void;
}

const roles: { value: OrganizationRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'member', label: 'Mitglied' },
];

interface Invitation {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  createdAt: string;
}

export function MembersModal({ isOpen, organization, onClose }: MembersModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingMember, setEditingMember] = useState<UserOrganization | null>(null);
  const [editingRole, setEditingRole] = useState<OrganizationRole>('member');

  const organizationId = organization?.id || '';
  const { data: members, isLoading: membersLoading } = useMembers(organizationId);
  const { data: invitationsResponse, isLoading: invitationsLoading } = useInvitations(organizationId);
  const createInvitation = useCreateInvitation(organizationId);
  const deleteInvitation = useDeleteInvitation(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const updateMember = useUpdateMember(organizationId);

  const invitations = (invitationsResponse as { data?: Invitation[] })?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<{ email: string; role: OrganizationRole }>({
    defaultValues: { email: '', role: 'member' },
  });

  const isLoading = membersLoading || invitationsLoading;

  const handleInvite = async (data: { email: string; role: OrganizationRole }) => {
    try {
      await createInvitation.mutateAsync(data);
      reset();
      setShowInviteForm(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await deleteInvitation.mutateAsync(invitationId);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRemove = async (member: UserOrganization) => {
    if (!confirm(t('removeConfirm.message'))) return;
    try {
      await removeMember.mutateAsync(member.userId);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRoleChange = async (member: UserOrganization) => {
    try {
      await updateMember.mutateAsync({ userId: member.userId, role: editingRole });
      setEditingMember(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setShowInviteForm(false);
    setEditingMember(null);
    reset();
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal__panel" style={{ maxWidth: 640 }}>
        <div className="modal__head">
          <h2 className="modal__title">
            {t('title')} &ndash; {organization?.name}
          </h2>
          <button type="button" className="btn btn--ghost" style={{ padding: '6px 8px', minWidth: 0 }} onClick={handleClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Invite form toggle */}
          {showInviteForm ? (
            <form
              onSubmit={handleSubmit(handleInvite)}
              style={{
                borderRadius: 10,
                border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                background: 'color-mix(in oklab, var(--ink) 3%, var(--paper))',
                padding: 14,
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('invite')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <label className="auth-field" style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontSize: 12 }}>{t('form.email')}</span>
                  <input
                    type="email"
                    className={`input${errors.email ? ' input--error' : ''}`}
                    placeholder={t('form.emailPlaceholder')}
                    {...register('email', { required: true })}
                  />
                </label>
                <label className="auth-field" style={{ width: 160 }}>
                  <span style={{ fontSize: 12 }}>Rolle</span>
                  <select className="select" {...register('role')}>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn--primary" style={{ fontSize: 13 }} disabled={createInvitation.isPending}>
                    {createInvitation.isPending ? '...' : t('invite')}
                  </button>
                  <button type="button" className="btn btn--ghost" style={{ fontSize: 13 }} onClick={() => setShowInviteForm(false)}>
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button type="button" className="btn btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => setShowInviteForm(true)}>
              {t('invite')}
            </button>
          )}

          {/* Loading */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 56, borderRadius: 8, background: 'color-mix(in oklab, var(--ink) 6%, var(--paper))' }} />
              ))}
            </div>
          ) : (
            <>
              {/* Pending invitations */}
              {invitations.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t('invitations.title')} ({invitations.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          borderRadius: 8,
                          border: '1px dashed color-mix(in oklab, var(--amber, #f59e0b) 50%, transparent)',
                          background: 'color-mix(in oklab, var(--amber, #f59e0b) 6%, var(--paper))',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'color-mix(in oklab, var(--amber, #f59e0b) 20%, var(--paper))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--amber, #f59e0b)" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {invitation.email}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0 }}>
                            {t('invitations.expiresAt')}: {formatDate(invitation.expiresAt)}
                          </p>
                        </div>
                        <span className="badge badge--warning">{t('invitations.pending')}</span>
                        <span className={`badge ${invitation.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
                          {t(`roles.${invitation.role}`)}
                        </span>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                          onClick={() => handleCancelInvitation(invitation.id)}
                          disabled={deleteInvitation.isPending}
                        >
                          {t('actions.cancelInvitation')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members list */}
              {!members || members.length === 0 ? (
                invitations.length === 0 && (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <p className="empty-state__sub">{t('empty.description')}</p>
                  </div>
                )
              ) : (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 8 }}>
                    {t('title')} ({members.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {members.map((member) => {
                      const memberUser = (member as UserOrganization & { user?: { firstName: string; lastName: string; email: string; avatarUrl: string | null } }).user;
                      const isEditing = editingMember?.id === member.id;

                      return (
                        <div
                          key={member.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 8,
                            border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                            color: 'var(--green-ink)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'var(--f-mono)',
                            flexShrink: 0,
                          }}>
                            {(memberUser?.firstName?.[0] || '').toUpperCase()}{(memberUser?.lastName?.[0] || '').toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {memberUser?.firstName} {memberUser?.lastName}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {memberUser?.email}
                            </p>
                          </div>

                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <select
                                className="select"
                                style={{ width: 140 }}
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value as OrganizationRole)}
                              >
                                {roles.map((role) => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn--primary"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => handleRoleChange(member)}
                                disabled={updateMember.isPending}
                              >
                                {updateMember.isPending ? '...' : tCommon('save')}
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => setEditingMember(null)}
                              >
                                {tCommon('cancel')}
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className={`badge ${member.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
                                {t(`roles.${member.role}`)}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                                {formatDate(member.createdAt)}
                              </span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  style={{ fontSize: 12, padding: '3px 8px' }}
                                  onClick={() => { setEditingMember(member); setEditingRole(member.role); }}
                                >
                                  {t('actions.changeRole')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  style={{ fontSize: 12, padding: '3px 8px', color: 'var(--red, #dc2626)' }}
                                  onClick={() => handleRemove(member)}
                                >
                                  {t('actions.remove')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {tCommon('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
