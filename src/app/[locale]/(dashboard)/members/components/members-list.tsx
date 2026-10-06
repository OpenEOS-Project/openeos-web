'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useCanCreateMemberAccount, useMembers } from '@/hooks/use-members';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
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
  const locale = useIntlLocale();
  const tAdd = useTranslations('memberAdd');
  const { user } = useAuthStore();
  const addLabel = useCanCreateMemberAccount() ? tAdd('openButton') : t('invite');
  const { data: members, isLoading, error } = useMembers(organizationId);

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!members || members.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="users" size={28} />
        }
        action={
          <button type="button" className="btn btn--primary" onClick={onInviteClick}>
            {addLabel}
          </button>
        }
      />
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
              steht wie bei den Geraeten nur die Anzahl. */}
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: members.length })}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={onInviteClick}>
          {addLabel}
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
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 }}>{t('list.you')}</span>
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
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                          onClick={() => onRemoveClick(member)}
                          aria-label={t('actions.remove')}
                          title={t('actions.remove')}
                        >
                          <Icon name="trash" size={16} />
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
