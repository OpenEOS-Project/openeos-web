'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Clock, Mail01, Plus, Trash01, UserEdit, X } from '@untitledui/icons';

import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Select } from '@/components/ui/select/select';
import { useMembers, useCreateInvitation, useRemoveMember, useUpdateMemberRole, useInvitations, useDeleteInvitation } from '@/hooks/use-members';
import type { Organization } from '@/types/organization';
import type { OrganizationRole, UserOrganization } from '@/types/auth';

interface MembersModalProps {
  isOpen: boolean;
  organization: Organization | null;
  onClose: () => void;
}

const roleColors: Record<OrganizationRole, 'purple' | 'blue' | 'success' | 'orange' | 'gray'> = {
  admin: 'purple',
  manager: 'blue',
  cashier: 'success',
  kitchen: 'orange',
  delivery: 'gray',
};

const roles: { value: OrganizationRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kassierer' },
  { value: 'kitchen', label: 'Kueche' },
  { value: 'delivery', label: 'Ausgabe' },
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

  const organizationId = organization?.id || '';
  const { data: members, isLoading: membersLoading } = useMembers(organizationId);
  const { data: invitationsResponse, isLoading: invitationsLoading } = useInvitations(organizationId);
  const createInvitation = useCreateInvitation(organizationId);
  const deleteInvitation = useDeleteInvitation(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const updateRole = useUpdateMemberRole(organizationId);

  // Extract invitations data from response
  const invitations = (invitationsResponse as { data?: Invitation[] })?.data || [];

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ email: string; role: OrganizationRole }>({
    defaultValues: { email: '', role: 'cashier' },
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

  const handleRoleChange = async (member: UserOrganization, newRole: OrganizationRole) => {
    try {
      await updateRole.mutateAsync({ userId: member.userId, role: newRole });
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

  // Don't render anything if not open - prevents flashing
  if (!isOpen) return null;

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-2xl">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('title')} - {organization?.name}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Body */}
              <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
                {/* Invite Form */}
                {showInviteForm ? (
                  <form onSubmit={handleSubmit(handleInvite)} className="rounded-lg border border-secondary bg-secondary p-4">
                    <h4 className="mb-3 text-sm font-medium text-primary">{t('invite')}</h4>
                    <div className="flex flex-wrap gap-3">
                      <Controller
                        name="email"
                        control={control}
                        rules={{ required: true }}
                        render={({ field }) => (
                          <Input
                            type="email"
                            placeholder={t('form.emailPlaceholder')}
                            value={field.value}
                            onChange={field.onChange}
                            isInvalid={!!errors.email}
                            className="min-w-[200px] flex-1"
                          />
                        )}
                      />
                      <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                          <Select
                            selectedKey={field.value}
                            onSelectionChange={(key) => field.onChange(key)}
                            className="w-40"
                          >
                            {roles.map((role) => (
                              <Select.Item key={role.value} id={role.value}>
                                {role.label}
                              </Select.Item>
                            ))}
                          </Select>
                        )}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" isLoading={createInvitation.isPending}>
                          {t('invite')}
                        </Button>
                        <Button type="button" color="secondary" onClick={() => setShowInviteForm(false)}>
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <Button iconLeading={Plus} onClick={() => setShowInviteForm(true)}>
                    {t('invite')}
                  </Button>
                )}

                {/* Loading State */}
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Pending Invitations */}
                    {invitations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-2 text-sm font-medium text-tertiary">
                          <Clock className="size-4" />
                          {t('invitations.title')} ({invitations.length})
                        </h4>
                        {invitations.map((invitation) => (
                          <div
                            key={invitation.id}
                            className="flex items-center gap-3 rounded-lg border border-dashed border-warning-solid bg-warning-secondary/20 p-3"
                          >
                            <div className="flex size-8 items-center justify-center rounded-full bg-warning-secondary">
                              <Mail01 className="size-4 text-warning-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-primary">
                                {invitation.email}
                              </p>
                              <p className="text-xs text-tertiary">
                                {t('invitations.expiresAt')}: {formatDate(invitation.expiresAt)}
                              </p>
                            </div>
                            <Badge color="warning">{t('invitations.pending')}</Badge>
                            <Badge color={roleColors[invitation.role]}>
                              {t(`roles.${invitation.role}`)}
                            </Badge>
                            <Button
                              size="sm"
                              color="secondary"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              isLoading={deleteInvitation.isPending}
                            >
                              {t('actions.cancelInvitation')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Members List */}
                    {!members || members.length === 0 ? (
                      invitations.length === 0 && (
                        <div className="py-8 text-center text-tertiary">{t('empty.description')}</div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-tertiary">
                          {t('title')} ({members.length})
                        </h4>
                        {members.map((member) => {
                          const memberUser = (member as UserOrganization & { user?: { firstName: string; lastName: string; email: string; avatarUrl: string | null } }).user;

                          return (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-lg border border-secondary p-3"
                            >
                              <Avatar
                                size="sm"
                                src={memberUser?.avatarUrl || undefined}
                                initials={`${memberUser?.firstName?.[0] || ''}${memberUser?.lastName?.[0] || ''}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-primary">
                                  {memberUser?.firstName} {memberUser?.lastName}
                                </p>
                                <p className="truncate text-xs text-tertiary">{memberUser?.email}</p>
                              </div>

                              {editingMember?.id === member.id ? (
                                <div className="flex items-center gap-2">
                                  <Select
                                    selectedKey={member.role}
                                    onSelectionChange={(key) => handleRoleChange(member, key as OrganizationRole)}
                                    className="w-36"
                                  >
                                    {roles.map((role) => (
                                      <Select.Item key={role.value} id={role.value}>
                                        {role.label}
                                      </Select.Item>
                                    ))}
                                  </Select>
                                  <Button size="sm" color="secondary" onClick={() => setEditingMember(null)}>
                                    {tCommon('cancel')}
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Badge color={roleColors[member.role]}>
                                    {t(`roles.${member.role}`)}
                                  </Badge>
                                  <span className="hidden text-xs text-tertiary sm:inline">
                                    {formatDate(member.createdAt)}
                                  </span>
                                  <Dropdown.Root>
                                    <Dropdown.DotsButton />
                                    <Dropdown.Popover className="w-min">
                                      <Dropdown.Menu>
                                        <Dropdown.Item icon={UserEdit} onAction={() => setEditingMember(member)}>
                                          <span className="pr-4">{t('actions.changeRole')}</span>
                                        </Dropdown.Item>
                                        <Dropdown.Separator />
                                        <Dropdown.Item
                                          icon={Trash01}
                                          className="text-error-primary"
                                          onAction={() => handleRemove(member)}
                                        >
                                          <span className="pr-4">{t('actions.remove')}</span>
                                        </Dropdown.Item>
                                      </Dropdown.Menu>
                                    </Dropdown.Popover>
                                  </Dropdown.Root>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                <Button color="secondary" onClick={handleClose}>
                  {tCommon('close')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
