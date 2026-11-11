'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useCanCreateMemberAccount, useMembers } from '@/hooks/use-members';
import { useOrganization } from '@/hooks/use-organizations';
import { useAuthStore } from '@/stores/auth-store';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import {
  AdminTable,
  CellMain,
  CellNone,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import type { OrganizationPermissions, UserOrganization } from '@/types/auth';
import { seatUsage } from '@/utils/limits';

import '@/styles/admin-table-wave2.css';

type MemberRow = UserOrganization & {
  user?: { firstName: string; lastName: string; email: string; avatarUrl: string | null };
};

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
  'waiters',
  'shiftPlans',
];

export function MembersList({ organizationId, onInviteClick, onRemoveClick, onEditPermissionsClick }: MembersListProps) {
  const t = useTranslations('members');
  const locale = useIntlLocale();
  const tAdd = useTranslations('memberAdd');
  const { user } = useAuthStore();
  const addLabel = useCanCreateMemberAccount() ? tAdd('openButton') : t('invite');
  const { data: members, isLoading, error } = useMembers(organizationId);
  /* Belegte Plaetze (Mitglieder plus offene Einladungen) und die wirksame
     Schranke kommen mit der Organisation; ein Super-Admin darf trotzdem
     einladen, fuer ihn prueft die API nicht. */
  const { data: organization } = useOrganization(organizationId);
  const seats = seatUsage(organization?.memberCount, organization?.memberLimit);
  const inviteBlocked = seats.full && !user?.isSuperAdmin;
  const seatsLabel = seats.unlimited
    ? t('seats.unlimited', { used: seats.used })
    : t('seats.used', { used: seats.used, limit: seats.limit });
  const inviteButton = (
    <button
      type="button"
      className="btn btn--primary"
      onClick={onInviteClick}
      disabled={inviteBlocked}
      title={inviteBlocked ? t('seats.fullHint', { limit: seats.limit }) : undefined}
      aria-disabled={inviteBlocked || undefined}
    >
      {addLabel}
    </button>
  );

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
        action={inviteButton}
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

  const fullName = (member: MemberRow) => `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim();

  const columns: DataColumn<MemberRow>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (member) => {
        const name = fullName(member);
        const isCurrentUser = member.userId === user?.id;
        return (
          <CellMain
            media={
              <span className="members-list__avatar" aria-hidden>
                {(member.user?.firstName?.[0] || '').toUpperCase()}
                {(member.user?.lastName?.[0] || '').toUpperCase()}
              </span>
            }
            title={
              <>
                {name}
                {isCurrentUser && <span className="members-list__you">{t('list.you')}</span>}
              </>
            }
            titleText={name}
          />
        );
      },
    },
    {
      id: 'email',
      header: t('table.email'),
      mobile: 'meta',
      className: 'members-list__email',
      cell: (member) =>
        member.user?.email ? <CellText title={member.user.email}>{member.user.email}</CellText> : <CellNone />,
    },
    {
      id: 'role',
      header: t('table.role'),
      mobile: 'subtitle',
      cell: (member) => (
        <span className={`badge ${member.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
          {t(`roles.${member.role}`)}
        </span>
      ),
    },
    {
      id: 'permissions',
      header: t('table.permissions'),
      priority: 2,
      cell: (member) => {
        if (member.role === 'admin') return <span className="admin-cell-text--muted">{t('table.allPermissions')}</span>;
        const active = PERMISSION_KEYS.filter((key) => member.permissions?.[key]);
        if (active.length === 0) return <CellNone />;
        return (
          <span className="members-list__perms">
            {active.map((key) => (
              <span key={key} className="badge badge--neutral">
                {t(`permissions.${key}`)}
              </span>
            ))}
          </span>
        );
      },
    },
    {
      id: 'joinedAt',
      header: t('table.joinedAt'),
      priority: 3,
      className: 'admin-dt__date',
      cell: (member) => formatDate(member.createdAt),
    },
  ];

  // Das eigene Konto lässt sich hier weder ändern noch entfernen.
  const actions = (member: MemberRow): RowAction[] => [
    {
      id: 'permissions',
      label: t('actions.editPermissions'),
      icon: 'edit',
      hidden: member.userId === user?.id,
      onClick: () => onEditPermissionsClick(member),
    },
    {
      id: 'remove',
      label: t('actions.remove'),
      icon: 'trash',
      danger: true,
      hidden: member.userId === user?.id,
      onClick: () => onRemoveClick(member),
    },
  ];

  const seatsHint = inviteBlocked ? t('seats.fullHint', { limit: seats.limit }) : undefined;

  return (
    <div className="app-card app-card--flat">
      <ListHead
        actions={
          <ListAction
            variant="primary"
            icon="plus"
            label={addLabel}
            onClick={onInviteClick}
            disabled={inviteBlocked}
            aria-disabled={inviteBlocked || undefined}
          />
        }
      >
        {/* Titel und Untertitel standen schon im Seitenkopf darueber; hier
            stehen wie bei den Geraeten die Anzahl und die belegten Plätze. */}
        <ListCount>{t('count', { count: members.length })}</ListCount>
        <span
          data-testid="member-seats"
          className={inviteBlocked ? 'members-list__seats is-full' : 'members-list__seats'}
          title={seatsHint}
        >
          {seatsLabel}
        </span>
      </ListHead>
      {inviteBlocked && (
        <p role="status" style={{ margin: '12px 20px', fontSize: 12, color: 'var(--mute)' }}>
          {seatsHint}
        </p>
      )}

      <AdminTable caption={t('title')} rows={members as MemberRow[]} rowKey="id" columns={columns} actions={actions} />
    </div>
  );
}
