'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Edit01, Plus, Trash01, Users01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useAdminOrganizations } from '@/hooks/use-organizations';
import type { Organization } from '@/types';

interface OrganizationsListProps {
  onCreateClick: () => void;
  onEditClick: (organization: Organization) => void;
  onDeleteClick: (organization: Organization) => void;
  onManageMembersClick: (organization: Organization) => void;
}

export function OrganizationsList({ onCreateClick, onEditClick, onDeleteClick, onManageMembersClick }: OrganizationsListProps) {
  const t = useTranslations('organizations');
  const tCommon = useTranslations('common');
  const { data, isLoading, error } = useAdminOrganizations();
  const organizations = data?.data;

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

  if (!organizations || organizations.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="building"
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button iconLeading={Plus} onClick={onCreateClick}>
              {t('create')}
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
    <>
      {/* Mobile: Card Layout */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
            <Badge color="gray" size="sm">{organizations.length}</Badge>
          </div>
          <Button size="sm" iconLeading={Plus} onClick={onCreateClick}>
            {t('create')}
          </Button>
        </div>
        {organizations.map((org) => (
          <div
            key={org.id}
            className="rounded-xl border border-secondary bg-primary p-4 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
                <span className="text-sm font-semibold text-brand-primary">
                  {org.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">{org.name}</p>
                <p className="text-xs text-tertiary font-mono">{org.slug}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-tertiary">
                  <span>{org.settings?.currency || 'EUR'}</span>
                  <span>{formatDate(org.createdAt)}</span>
                </div>
              </div>
              <Dropdown.Root>
                <Dropdown.DotsButton />
                <Dropdown.Popover className="w-min">
                  <Dropdown.Menu>
                    <Dropdown.Item icon={Edit01} onAction={() => onEditClick(org)}>
                      <span className="pr-4">{t('actions.edit')}</span>
                    </Dropdown.Item>
                    <Dropdown.Item icon={Users01} onAction={() => onManageMembersClick(org)}>
                      <span className="pr-4">{t('actions.manageMembers')}</span>
                    </Dropdown.Item>
                    <Dropdown.Separator />
                    <Dropdown.Item
                      icon={Trash01}
                      className="text-error-primary"
                      onAction={() => onDeleteClick(org)}
                    >
                      <span className="pr-4">{t('actions.delete')}</span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block">
        <TableCard.Root>
          <TableCard.Header
            title={t('title')}
            badge={organizations.length}
            description={t('subtitle')}
            contentTrailing={
              <Button iconLeading={Plus} onClick={onCreateClick}>
                {t('create')}
              </Button>
            }
          />
          <Table aria-label={t('title')}>
            <Table.Header>
              <Table.Head label={t('table.name')} isRowHeader />
              <Table.Head label={t('table.slug')} />
              <Table.Head label={t('table.createdAt')} />
              <Table.Head label={t('table.actions')} />
            </Table.Header>
            <Table.Body items={organizations}>
              {(organization) => (
                <Table.Row key={organization.id} id={organization.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-brand-secondary">
                        <span className="text-sm font-semibold text-brand-primary">
                          {organization.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">{organization.name}</p>
                        <p className="text-xs text-tertiary">{organization.settings?.currency || 'EUR'}</p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-sm">{organization.slug}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm">{formatDate(organization.createdAt)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Dropdown.Root>
                      <Dropdown.DotsButton />
                      <Dropdown.Popover className="w-min">
                        <Dropdown.Menu>
                          <Dropdown.Item icon={Edit01} onAction={() => onEditClick(organization)}>
                            <span className="pr-4">{t('actions.edit')}</span>
                          </Dropdown.Item>
                          <Dropdown.Item icon={Users01} onAction={() => onManageMembersClick(organization)}>
                            <span className="pr-4">{t('actions.manageMembers')}</span>
                          </Dropdown.Item>
                          <Dropdown.Separator />
                          <Dropdown.Item
                            icon={Trash01}
                            className="text-error-primary"
                            onAction={() => onDeleteClick(organization)}
                          >
                            <span className="pr-4">{t('actions.delete')}</span>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </TableCard.Root>
      </div>
    </>
  );
}
