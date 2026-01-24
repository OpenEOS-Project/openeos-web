'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash01, UserEdit } from '@untitledui/icons';

import { Avatar } from '@/components/ui/avatar/avatar';
import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useMembers } from '@/hooks/use-members';
import { useAuthStore } from '@/stores/auth-store';
import type { OrganizationRole, UserOrganization } from '@/types/auth';

interface MembersListProps {
  organizationId: string;
  onInviteClick: () => void;
  onRemoveClick: (member: UserOrganization) => void;
}

const roleColors: Record<OrganizationRole, 'purple' | 'blue' | 'success' | 'orange' | 'gray'> = {
  admin: 'purple',
  manager: 'blue',
  cashier: 'success',
  kitchen: 'orange',
  delivery: 'gray',
};

export function MembersList({ organizationId, onInviteClick, onRemoveClick }: MembersListProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const { user } = useAuthStore();
  const { data: members, isLoading, error } = useMembers(organizationId);

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

  if (!members || members.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="users"
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button iconLeading={Plus} onClick={onInviteClick}>
              {t('invite')}
            </Button>
          }
        />
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
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={members.length}
        description={t('subtitle')}
        contentTrailing={
          <Button iconLeading={Plus} onClick={onInviteClick}>
            {t('invite')}
          </Button>
        }
      />
      <Table aria-label={t('title')}>
        <Table.Header>
          <Table.Head label={t('table.name')} isRowHeader />
          <Table.Head label={t('table.email')} />
          <Table.Head label={t('table.role')} />
          <Table.Head label={t('table.joinedAt')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={members}>
          {(member) => {
            const memberUser = (member as UserOrganization & { user?: { firstName: string; lastName: string; email: string; avatarUrl: string | null } }).user;
            const isCurrentUser = member.userId === user?.id;

            return (
              <Table.Row key={member.id} id={member.id}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="sm"
                      src={memberUser?.avatarUrl || undefined}
                      initials={`${memberUser?.firstName?.[0] || ''}${memberUser?.lastName?.[0] || ''}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {memberUser?.firstName} {memberUser?.lastName}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-tertiary">(Du)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">{memberUser?.email}</span>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={roleColors[member.role]}>
                    {t(`roles.${member.role}`)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">{formatDate(member.createdAt)}</span>
                </Table.Cell>
                <Table.Cell>
                  {!isCurrentUser && (
                    <Dropdown.Root>
                      <Dropdown.DotsButton />
                      <Dropdown.Popover className="w-min">
                        <Dropdown.Menu>
                          <Dropdown.Item icon={UserEdit}>
                            <span className="pr-4">{t('actions.changeRole')}</span>
                          </Dropdown.Item>
                          <Dropdown.Separator />
                          <Dropdown.Item
                            icon={Trash01}
                            className="text-error-primary"
                            onAction={() => onRemoveClick(member)}
                          >
                            <span className="pr-4">{t('actions.remove')}</span>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          }}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
}
