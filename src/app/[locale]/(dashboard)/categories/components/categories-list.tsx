'use client';

import { useTranslations } from 'next-intl';
import { Edit01, Plus, Tag01, Trash01 } from '@untitledui/icons';

import { Badge } from '@/components/ui/badges/badges';
import { Button } from '@/components/ui/buttons/button';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Table, TableCard } from '@/components/ui/table/table';
import { useCategories } from '@/hooks/use-categories';
import type { Category } from '@/types/category';

interface CategoriesListProps {
  eventId: string;
  onCreateClick: () => void;
  onEditClick: (category: Category) => void;
  onDeleteClick: (category: Category) => void;
}

export function CategoriesList({
  eventId,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: CategoriesListProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

  const { data: categories, isLoading, error } = useCategories(eventId);

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

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="tag"
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

  return (
    <TableCard.Root>
      <TableCard.Header
        title={t('title')}
        badge={categories.length}
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
          <Table.Head label={t('table.description')} />
          <Table.Head label={t('table.status')} />
          <Table.Head label={t('table.sortOrder')} />
          <Table.Head label={t('table.actions')} />
        </Table.Header>
        <Table.Body items={categories}>
          {(category) => (
            <Table.Row key={category.id} id={category.id}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: category.color ? `${category.color}20` : undefined,
                    }}
                  >
                    <Tag01
                      className="size-5"
                      style={{ color: category.color || undefined }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">{category.name}</p>
                    {category.parentId && (
                      <p className="text-xs text-tertiary">Unterkategorie</p>
                    )}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm text-tertiary line-clamp-1">
                  {category.description || '-'}
                </span>
              </Table.Cell>
              <Table.Cell>
                <Badge color={category.isActive ? 'success' : 'gray'} size="sm">
                  {t(`status.${category.isActive ? 'active' : 'inactive'}`)}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <span className="text-sm">{category.sortOrder}</span>
              </Table.Cell>
              <Table.Cell>
                <Dropdown.Root>
                  <Dropdown.DotsButton />
                  <Dropdown.Popover className="w-min">
                    <Dropdown.Menu>
                      <Dropdown.Item icon={Edit01} onAction={() => onEditClick(category)}>
                        <span className="pr-4">{t('actions.edit')}</span>
                      </Dropdown.Item>
                      <Dropdown.Separator />
                      <Dropdown.Item
                        icon={Trash01}
                        className="text-error-primary"
                        onAction={() => onDeleteClick(category)}
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
  );
}
