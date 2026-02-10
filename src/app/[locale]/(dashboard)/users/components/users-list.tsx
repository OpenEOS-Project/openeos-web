'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Eye,
  LockUnlocked01,
  ShieldTick,
  Building07,
} from '@untitledui/icons';

import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge, BadgeWithIcon } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useAdminUsers, useUnlockUser } from '@/hooks/use-admin';
import type { AdminUser } from '@/types/admin';

const ROLE_COLORS: Record<string, 'purple' | 'blue'> = {
  admin: 'purple',
  member: 'blue',
};

export function UsersList() {
  const t = useTranslations('users');
  const tMembers = useTranslations('members');
  const tCommon = useTranslations('common');
  const router = useRouter();
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

  const getUserStatus = (user: AdminUser) => {
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
        return <Badge color="success" size="sm">{t('status.active')}</Badge>;
      case 'inactive':
        return <Badge color="gray" size="sm">{t('status.inactive')}</Badge>;
      case 'locked':
        return <Badge color="error" size="sm">{t('status.locked')}</Badge>;
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
    <>
      {/* Mobile: Card Layout */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
          <Badge color="gray" size="sm">{users.length}</Badge>
        </div>
        {users.map((user) => {
          const status = getUserStatus(user);
          const orgs = user.userOrganizations ?? [];
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => router.push(`/users/${user.id}`)}
              className="w-full rounded-xl border border-secondary bg-primary p-4 shadow-xs text-left active:bg-secondary transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  size="md"
                  src={user.avatarUrl || undefined}
                  initials={`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-primary truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <ChevronRight className="h-4 w-4 text-quaternary shrink-0" />
                  </div>
                  <p className="text-xs text-tertiary truncate mt-0.5">{user.email}</p>

                  {/* Badges row */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {getStatusBadge(status)}
                    {user.isSuperAdmin ? (
                      <BadgeWithIcon color="purple" size="sm" iconLeading={ShieldTick}>
                        {t('role.superAdmin')}
                      </BadgeWithIcon>
                    ) : orgs.length > 0 ? (
                      orgs.map((uo) => (
                        <Badge key={uo.id} color={ROLE_COLORS[uo.role] ?? 'gray'} size="sm">
                          {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                        </Badge>
                      ))
                    ) : null}
                  </div>

                  {/* Organizations */}
                  {orgs.length > 0 && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {orgs.map((uo) => (
                        <span key={uo.id} className="flex items-center gap-1 text-xs text-tertiary">
                          <Building07 className="h-3 w-3 shrink-0" />
                          {uo.organization?.name ?? '-'}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Last login */}
                  {user.lastLoginAt && (
                    <p className="mt-1.5 text-xs text-quaternary">
                      {t('table.lastLogin')}: {formatDate(user.lastLoginAt)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block">
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
                const orgs = user.userOrganizations ?? [];
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
                      ) : orgs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {orgs.map((uo) => (
                            <Badge key={uo.id} color={ROLE_COLORS[uo.role] ?? 'gray'} size="sm">
                              {tMembers(`roles.${uo.role}` as Parameters<typeof tMembers>[0])}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge color="gray">{t('role.user')}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {orgs.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {orgs.map((uo) => (
                            <span key={uo.id} className="flex items-center gap-1 text-sm text-secondary">
                              <Building07 className="h-3.5 w-3.5 text-tertiary shrink-0" />
                              {uo.organization?.name ?? '-'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-quaternary">-</span>
                      )}
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
                            <Dropdown.Item
                              icon={Eye}
                              onAction={() => router.push(`/users/${user.id}`)}
                            >
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
      </div>
    </>
  );
}
