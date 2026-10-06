'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

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
  const locale = useIntlLocale();
  const deleteInvitation = useDeleteInvitation(organizationId);
  const resendInvitation = useResendInvitation(organizationId);
  const { data: invitationsResponse, isLoading } = useInvitations(organizationId);

  const invitations = (invitationsResponse as { data?: Invitation[] })?.data
    || (Array.isArray(invitationsResponse) ? invitationsResponse as Invitation[] : []);

  if (isLoading || invitations.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
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
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={16} style={{ color: 'var(--ink-faint)' }} />
          <h3 className="app-card__title">
            {t('invitations.title')}
            <span className="badge badge--warning" style={{ marginLeft: 8 }}>{invitations.length}</span>
          </h3>
        </div>
      </div>

      <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
        {invitations.map((invitation) => {
          const isAdmin = invitation.role === 'admin';
          const activePermissions = !isAdmin
            ? PERMISSION_KEYS.filter((key) => invitation.permissions?.[key])
            : [];

          return (
            <div
              key={invitation.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'color-mix(in oklab, var(--amber, var(--warn)) 15%, var(--paper))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name="mail" size={14} style={{ color: 'var(--amber, var(--warn))' }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {invitation.email}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: 0 }}>
                  {t('invitations.expiresAt')}: {formatDate(invitation.expiresAt)}
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                <span className="badge badge--warning">{t('invitations.pending')}</span>
                <span className={`badge ${isAdmin ? 'badge--info' : 'badge--neutral'}`}>
                  {t(`roles.${invitation.role}`)}
                </span>
                {activePermissions.map((key) => (
                  <span key={key} className="badge badge--neutral" style={{ fontSize: 10 }}>
                    {t(`permissions.${key}`)}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => handleResend(invitation.id)}
                  disabled={resendInvitation.isPending}
                >
                  {t('actions.resendInvitation')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => handleCancel(invitation.id)}
                  disabled={deleteInvitation.isPending}
                >
                  {t('actions.cancelInvitation')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
