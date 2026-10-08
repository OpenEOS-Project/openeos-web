'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { useCategories } from '@/hooks/use-categories';
import { useProductionStations } from '@/hooks/use-production-stations';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
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

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
              Untertitel stehen schon im Seitenkopf darueber. */}
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('count', { count: categories.length })}</p>
        </div>
        <button className="btn btn--primary" onClick={onCreateClick}>
          {t('create')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.name')}</th>
              <th>{t('table.description')}</th>
              <th>{t('table.status')}</th>
              <th className="text-right">{t('table.sortOrder')}</th>
              <th style={{ width: 120 }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Icon der Kategorie in ihrer Farbe: getönte Fläche, Icon
                        in der Kategoriefarbe (Kontrast regelt @openeos/ui). */}
                    <IconVisual source={resolveCategoryIcon(category)} alt="" size="sm" accent={categoryAccent(category)} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{category.name}</div>
                      {category.parentId && (
                        <div style={{ fontSize: 11, color: 'var(--ink)', opacity: 0.5 }}>{t('list.subcategory')}</div>
                      )}
                      {category.productionStationId && (() => {
                        const station = productionStations?.find((s) => s.id === category.productionStationId);
                        if (!station) return null;
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 600, lineHeight: 1,
                            padding: '2px 6px', borderRadius: 4, marginTop: 3,
                            background: station.color ? `${station.color}20` : 'color-mix(in oklab, var(--ink) 8%, transparent)',
                            color: station.color || 'var(--ink)',
                            border: `1px solid ${station.color ? `${station.color}40` : 'color-mix(in oklab, var(--ink) 15%, transparent)'}`,
                          }}>
                            {station.name}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 220 }}>
                    {category.description || '-'}
                  </span>
                </td>
                <td>
                  <span className={category.isActive ? 'badge badge--success' : 'badge badge--neutral'}>
                    {t(`status.${category.isActive ? 'active' : 'inactive'}`)}
                  </span>
                </td>
                <td className="mono text-right">{category.sortOrder}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0 }}
                      onClick={() => onEditClick(category)}
                      aria-label={t('actions.edit')}
                      title={t('actions.edit')}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={() => onDeleteClick(category)}
                      aria-label={t('actions.delete')}
                      title={t('actions.delete')}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
