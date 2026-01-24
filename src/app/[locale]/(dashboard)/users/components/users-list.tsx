'use client';

import { useTranslations } from 'next-intl';
import { Eye, LockUnlocked01, ShieldTick } from '@untitledui/icons';

import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge, BadgeWithIcon } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useAdminUsers, useUnlockUser } from '@/hooks/use-admin';

export function UsersList() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const { data, isLoading, error } = useAdminUsers();
  const unlockUser = useUnlockUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-tertiary">{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-error-primary">{tCommon('error')}</div>
        <Button color="secondary" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const users = data?.data ?? [];

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="users"
          title={t('empty.title')}
          description={t('empty.description')}
        />
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserStatus = (user: typeof users[0]) => {
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return 'locked';
    }
    if (!user.isActive) {
      return 'inactive';
    }
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="success">{t('status.active')}</Badge>;
      case 'inactive':
        return <Badge color="gray">{t('status.inactive')}</Badge>;
      case 'locked':
        return <Badge color="error">{t('status.locked')}</Badge>;
      default:
        return null;
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await unlockUser.mutateAsync(userId);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={users.length}
        description={t('subtitle')}
      />
      <Table aria-label={t('title')}>
        <Table.Header>
          <Table.Head label={t('table.name')} isRowHeader />
          <Table.Head label={t('table.email')} />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.role')} />
          <Table.Head label={t('table.organizations')} />
          <Table.Head label={t('table.lastLogin')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={users}>
          {(user) => {
            const status = getUserStatus(user);
            return (
              <Table.Row key={user.id} id={user.id}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      src={user.avatarUrl || undefined}
                      initials={`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">{user.email}</span>
                </Table.Cell>
                <Table.Cell>
                  {getStatusBadge(status)}
                </Table.Cell>
                <Table.Cell>
                  {user.isSuperAdmin ? (
                    <BadgeWithIcon color="purple" iconLeading={ShieldTick}>
                      {t('role.superAdmin')}
                    </BadgeWithIcon>
                  ) : (
                    <Badge color="gray">{t('role.user')}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">
                    {user.userOrganizations?.length || 0}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-tertiary">
                    {formatDate(user.lastLoginAt)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Dropdown.Root>
                    <Dropdown.DotsButton />
                    <Dropdown.Popover className="w-min">
                      <Dropdown.Menu>
                        <Dropdown.Item icon={Eye}>
                          <span className="pr-4">{t('actions.view')}</span>
                        </Dropdown.Item>
                        {status === 'locked' && (
                          <>
                            <Dropdown.Separator />
                            <Dropdown.Item
                              icon={LockUnlocked01}
                              onAction={() => handleUnlock(user.id)}
                            >
                              <span className="pr-4">{t('actions.unlock')}</span>
                            </Dropdown.Item>
                          </>
                        )}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                </Table.Cell>
              </Table.Row>
            );
          }}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
