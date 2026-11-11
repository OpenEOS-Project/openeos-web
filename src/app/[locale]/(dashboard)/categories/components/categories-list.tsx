'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';

import { useCategories } from '@/hooks/use-categories';
import { useProductionStations } from '@/hooks/use-production-stations';
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
import { IconVisual } from '@/components/shared/product-image';
import type { Category } from '@/types/category';
import { categoryAccent, resolveCategoryIcon } from '@/utils/product-icon';

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

  const { data: categories, isLoading, error } = useCategories(eventId);
  const { data: productionStations } = useProductionStations(eventId);

  if (isLoading) {
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!categories || categories.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="tag" size={28} />
        }
        action={
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        }
      />
    );
  }

  const stationOf = (category: Category) =>
    category.productionStationId
      ? productionStations?.find((s) => s.id === category.productionStationId)
      : undefined;

  const columns: DataColumn<Category>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (category) => {
        const station = stationOf(category);
        return (
          <CellMain
            /* Icon der Kategorie in ihrer Farbe: getönte Fläche, Icon in der
               Kategoriefarbe (Kontrast regelt @openeos/ui). */
            media={<IconVisual source={resolveCategoryIcon(category)} alt="" size="sm" accent={categoryAccent(category)} />}
            title={category.name}
            titleText={category.name}
            sub={category.parentId ? t('list.subcategory') : undefined}
            extra={
              station ? (
                <span
                  className="category-station-chip"
                  style={
                    station.color
                      ? { background: `${station.color}20`, color: station.color, borderColor: `${station.color}40` }
                      : undefined
                  }
                >
                  {station.name}
                </span>
              ) : undefined
            }
          />
        );
      },
    },
    {
      id: 'description',
      header: t('table.description'),
      mobile: 'meta',
      cell: (category) =>
        category.description ? (
          <CellText muted title={category.description}>{category.description}</CellText>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (category) => (
        <span className={category.isActive ? 'badge badge--success' : 'badge badge--neutral'}>
          {t(`status.${category.isActive ? 'active' : 'inactive'}`)}
        </span>
      ),
    },
    {
      id: 'sortOrder',
      header: t('table.sortOrder'),
      num: true,
      priority: 3,
      cell: (category) => category.sortOrder,
    },
  ];

  const actions = (category: Category): RowAction[] => [
    { id: 'edit', label: t('actions.edit'), icon: 'edit', onClick: () => onEditClick(category) },
    { id: 'delete', label: t('actions.delete'), icon: 'trash', danger: true, onClick: () => onDeleteClick(category) },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
          Untertitel stehen schon im Seitenkopf darueber. */}
      <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
        <ListCount>{t('count', { count: categories.length })}</ListCount>
      </ListHead>

      <AdminTable
        caption={t('title')}
        rows={categories}
        rowKey="id"
        columns={columns}
        actions={actions}
        rowClassName={(category) => (category.isActive ? undefined : 'admin-dt__row--muted')}
      />
    </div>
  );
}
