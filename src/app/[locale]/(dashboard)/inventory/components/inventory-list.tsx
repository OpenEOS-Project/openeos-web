'use client';

import { useTranslations } from 'next-intl';

import { useInventoryCounts, useDeleteInventoryCount } from '@/hooks/use-inventory';
import type { InventoryCount, InventoryCountStatus } from '@/types/inventory';

interface InventoryListProps {
  eventId: string;
  onCreateClick: () => void;
  onSelectCount: (count: InventoryCount) => void;
}

function StatusBadge({ status }: { status: InventoryCountStatus }) {
  const t = useTranslations('inventory');

  const classMap: Record<InventoryCountStatus, string> = {
    draft: 'badge badge--neutral',
    in_progress: 'badge badge--warning',
    completed: 'badge badge--success',
    cancelled: 'badge badge--error',
  };

  return (
    <span className={classMap[status]}>
      {t(`status.${status}`)}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatUserName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return '–';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || '–';
}

export function InventoryList({ eventId, onCreateClick, onSelectCount }: InventoryListProps) {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');

  const { data: counts, isLoading, error } = useInventoryCounts(eventId);
  const deleteCount = useDeleteInventoryCount(eventId);

  const handleDelete = async (e: React.MouseEvent, countId: string) => {
    e.stopPropagation();
    if (!confirm(t('deleteConfirm.message'))) return;
    try {
      await deleteCount.mutateAsync(countId);
    } catch {
      // handled by mutation
    }
  };

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

  if (!counts || counts.length === 0) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
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
          <h2 className="app-card__title">{t('list.title')}</h2>
          <p className="app-card__sub">{t('list.subtitle')}</p>
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
              <th>{t('table.status')}</th>
              <th>{t('table.createdAt')}</th>
              <th className="text-right">{t('table.itemCount')}</th>
              <th>{t('table.completedBy')}</th>
              <th style={{ width: 64 }}></th>
            </tr>
          </thead>
          <tbody>
            {counts.map((count) => (
              <tr
                key={count.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectCount(count)}
              >
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{count.name}</div>
                  {count.notes && (
                    <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                      {count.notes}
                    </div>
                  )}
                </td>
                <td>
                  <StatusBadge status={count.status} />
                </td>
                <td style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7 }}>
                  {formatDate(count.createdAt)}
                </td>
                <td className="text-right" style={{ fontSize: 13 }}>
                  {count.items ? count.items.length : '–'}
                </td>
                <td style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7 }}>
                  {formatUserName(count.completedByUser)}
                </td>
                <td>
                  {count.status === 'draft' && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: 6, minWidth: 0, color: '#dc2626' }}
                      onClick={(e) => handleDelete(e, count.id)}
                      aria-label={tCommon('delete')}
                      title={tCommon('delete')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
