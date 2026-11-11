'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { Building, LockOpen } from 'lucide-react';

import { useAdminUsers, useUnlockUser } from '@/hooks/use-admin';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellNone, CellText, ListCount, ListHead } from '@/components/shared/admin-table';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { AdminUser } from '@/types/admin';
import '@/styles/admin-table-wave4.css';

export function UsersList() {
  const t = useTranslations('users');
  const tMembers = useTranslations('members');
  // Datum mit Uhrzeit — "—" fuer fehlende Werte.
  const { formatDateTime: formatDate } = useLocaleFormat();
  const router = useRouter();
  const { data, isLoading, error } = useAdminUsers();
  const unlockUser = useUnlockUser();

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  const users = data?.data ?? [];

  if (users.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="users" size={28} />
        }
      />
    );
  }

  const getUserStatus = (user: AdminUser) => {
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return 'locked';
    if (!user.isActive) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge badge--success">{t('status.active')}</span>;
      case 'inactive': return <span className="badge badge--neutral">{t('status.inactive')}</span>;
      case 'locked': return <span className="badge badge--error">{t('status.locked')}</span>;
      default: return null;
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await unlockUser.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  };

  const openUser = (user: AdminUser) => router.push(`/users/${user.id}`);
  const fullName = (user: AdminUser) => `${user.firstName} ${user.lastName}`;

  const columns: DataColumn<AdminUser>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (user) => (
        <CellMain
          media={
            <span className="wave4-initials wave4-initials--round" aria-hidden>
              {(user.firstName?.[0] || '').toUpperCase()}
              {(user.lastName?.[0] || '').toUpperCase()}
            </span>
          }
          title={fullName(user)}
          titleText={fullName(user)}
        />
      ),
    },
    {
      id: 'email',
      header: t('table.email'),
      mobile: 'meta',
      className: 'wave4-mono',
      cell: (user) => <CellText title={user.email}>{user.email}</CellText>,
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (user) => getStatusBadge(getUserStatus(user)),
    },
    {
      id: 'role',
      header: t('table.role'),
      priority: 2,
      cell: (user) => {
        const orgs = user.userOrganizations ?? [];
        if (user.isSuperAdmin) return <span className="badge badge--info">{t('role.superAdmin')}</span>;
        if (orgs.length === 0) return <span className="badge badge--neutral">{t('role.user')}</span>;
        return (
          <span className="users-list__roles">
            {orgs.map((uo) => (
              <span key={uo.id} className={`badge ${uo.role === 'admin' ? 'badge--info' : 'badge--neutral'}`}>
                {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
              </span>
            ))}
          </span>
        );
      },
    },
    {
      id: 'organizations',
      header: t('table.organizations'),
      priority: 2,
      cell: (user) => {
        const orgs = user.userOrganizations ?? [];
        if (orgs.length === 0) return <CellNone />;
        return (
          <span className="wave4-stack">
            {orgs.map((uo) => (
              <span key={uo.id} className="users-list__org" title={uo.organization?.name}>
                <Building size={12} aria-hidden />
                <span>{uo.organization?.name ?? '-'}</span>
              </span>
            ))}
          </span>
        );
      },
    },
    {
      id: 'lastLogin',
      header: t('table.lastLogin'),
      priority: 3,
      className: 'wave4-date',
      cell: (user) => formatDate(user.lastLoginAt),
    },
  ];

  /* Die ganze Zeile öffnet die Details; „Entsperren“ nur bei gesperrten Konten. */
  const actions = (user: AdminUser): RowAction[] => [
    { id: 'view', label: t('actions.view'), icon: 'eye', onClick: () => openUser(user) },
    {
      id: 'unlock',
      label: t('actions.unlock'),
      icon: <LockOpen />,
      hidden: getUserStatus(user) !== 'locked',
      disabled: unlockUser.isPending,
      onClick: () => void handleUnlock(user.id),
    },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Anzahl statt eines zweiten Titels, wie auf den anderen Listen. */}
      <ListHead>
        <ListCount>{t('count', { count: users.length })}</ListCount>
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={users}
        rowKey="id"
        columns={columns}
        actions={actions}
        onRowClick={openUser}
      />
    </div>
  );
}
