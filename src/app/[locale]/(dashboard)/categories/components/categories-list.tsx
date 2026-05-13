'use client';

import { useTranslations } from 'next-intl';

import { useCategories } from '@/hooks/use-categories';
import { useProductionStations } from '@/hooks/use-production-stations';
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
  const { data: productionStations } = useProductionStations(eventId);

  if (isLoading) {
    return (
      <div className="app-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tCommon('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 24px' }}>
        <div style={{ color: '#d24545' }}>{tCommon('error')}</div>
        <button className="btn btn--ghost" onClick={() => window.location.reload()}>
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('empty.title')}</h3>
          <p className="empty-state__sub">{t('empty.description')}</p>
          <button className="btn btn--primary" onClick={onCreateClick}>
            {t('create')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card app-card--flat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
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
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: category.color ? `${category.color}20` : 'color-mix(in oklab, var(--ink) 8%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={category.color || 'currentColor'} strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{category.name}</div>
                      {category.parentId && (
                        <div style={{ fontSize: 11, color: 'var(--ink)', opacity: 0.5 }}>Unterkategorie</div>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: '#dc2626' }}
                      onClick={() => onDeleteClick(category)}
                      aria-label={t('actions.delete')}
                      title={t('actions.delete')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
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
