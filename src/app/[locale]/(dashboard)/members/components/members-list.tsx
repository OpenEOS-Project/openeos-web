'use client';

import { useTranslations } from 'next-intl';

import { useMembers } from '@/hooks/use-members';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationPermissions, UserOrganization } from '@/types/auth';

interface MembersListProps {
  organizationId: string;
  onInviteClick: () => void;
  onRemoveClick: (member: UserOrganization) => void;
  onEditPermissionsClick: (member: UserOrganization) => void;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

export function MembersList({ organizationId, onInviteClick, onRemoveClick, onEditPermissionsClick }: MembersListProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const { user } = useAuthStore();
  const { data: members, isLoading, error } = useMembers(organizationId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--red, var(--danger))' }}>{tCommon('error')}</span>
        <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <button type="button" className="btn btn--primary" onClick={onInviteClick}>
            {t('invite')}
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">
            {t('title')}
            <span className="pill" style={{ marginLeft: 8 }}>{members.length}</span>
          </h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onInviteClick}>
          {t('invite')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.email')}</th>
              <th>{t('table.role')}</th>
              <th>{t('table.permissions')}</th>
              <th>{t('table.joinedAt')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const memberUser = (member as UserOrganization & { user?: { firstName: string; lastName: string; email: string; avatarUrl: string | null } }).user;
              const isCurrentUser = member.userId === user?.id;
              const isAdmin = member.role === 'admin';
              const activePermissions = !isAdmin
                ? PERMISSION_KEYS.filter((key) => member.permissions?.[key])
                : [];

              return (
                <tr key={member.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
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
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {memberUser?.firstName} {memberUser?.lastName}
                        {isCurrentUser && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 }}>(Du)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{memberUser?.email}</td>
                  <td>
                    <span className={`badge ${isAdmin ? 'badge--info' : 'badge--neutral'}`}>
                      {t(`roles.${member.role}`)}
                    </span>
                  </td>
                  <td>
                    {isAdmin ? (
                      <span style={{ fontSize: 12, color: 'var(--mute)' }}>{t('table.allPermissions')}</span>
                    ) : activePermissions.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--mute)' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {activePermissions.map((key) => (
                          <span key={key} className="badge badge--neutral" style={{ fontSize: 10 }}>
                            {t(`permissions.${key}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{formatDate(member.createdAt)}</td>
                  <td>
                    {!isCurrentUser && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: 6, minWidth: 0 }}
                          onClick={() => onEditPermissionsClick(member)}
                          aria-label={t('actions.editPermissions')}
                          title={t('actions.editPermissions')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                          onClick={() => onRemoveClick(member)}
                          aria-label={t('actions.remove')}
                          title={t('actions.remove')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
