'use client';

import { useTranslations } from 'next-intl';
import { Clock, Mail01, RefreshCw01, Trash01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { useInvitations, useDeleteInvitation, useResendInvitation } from '@/hooks/use-members';
import type { OrganizationPermissions } from '@/types/auth';

interface InvitationsListProps {
  organizationId: string;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

interface Invitation {
  id: string;
  email: string;
  role: string;
  permissions?: OrganizationPermissions;
  expiresAt: string;
  createdAt: string;
}

export function InvitationsList({ organizationId }: InvitationsListProps) {
  const t = useTranslations('members');
  const deleteInvitation = useDeleteInvitation(organizationId);
  const resendInvitation = useResendInvitation(organizationId);
  const { data: invitationsResponse, isLoading } = useInvitations(organizationId);

  const invitations = (invitationsResponse as { data?: Invitation[] })?.data
    || (Array.isArray(invitationsResponse) ? invitationsResponse as Invitation[] : []);

  if (isLoading || invitations.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleResend = async (invitationId: string) => {
    try {
      await resendInvitation.mutateAsync(invitationId);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCancel = async (invitationId: string) => {
    try {
      await deleteInvitation.mutateAsync(invitationId);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="rounded-xl border border-secondary bg-primary shadow-xs">
      <div className="flex items-center gap-2 border-b border-secondary px-6 py-4">
        <Clock className="size-4 text-tertiary" />
        <h3 className="text-sm font-semibold text-primary">{t('invitations.title')}</h3>
        <Badge size="sm" color="warning">{invitations.length}</Badge>
      </div>
      <div className="divide-y divide-secondary">
        {invitations.map((invitation) => {
          const isAdmin = invitation.role === 'admin';
          const activePermissions = !isAdmin
            ? PERMISSION_KEYS.filter((key) => invitation.permissions?.[key])
            : [];

          return (
            <div
              key={invitation.id}
              className="flex items-center gap-3 px-6 py-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-secondary">
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
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge color="warning">{t('invitations.pending')}</Badge>
                <Badge color={isAdmin ? 'purple' : 'blue'}>
                  {t(`roles.${invitation.role}`)}
                </Badge>
                {activePermissions.map((key) => (
                  <Badge key={key} size="sm" color="gray">
                    {t(`permissions.${key}`)}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  color="tertiary"
                  iconLeading={RefreshCw01}
                  onClick={() => handleResend(invitation.id)}
                  isLoading={resendInvitation.isPending}
                >
                  {t('actions.resendInvitation')}
                </Button>
                <Button
                  size="sm"
                  color="tertiary"
                  iconLeading={Trash01}
                  onClick={() => handleCancel(invitation.id)}
                  isLoading={deleteInvitation.isPending}
                >
                  {t('actions.cancelInvitation')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
