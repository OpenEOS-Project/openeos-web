'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useInventoryCounts, useDeleteInventoryCount } from '@/hooks/use-inventory';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
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

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
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
  const locale = useIntlLocale();

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
    return <ListLoading />;
  }

  if (error) {
    return <ListError />;
  }

  if (!counts || counts.length === 0) {
    return (
      <ListEmpty
        title={t('empty.title')}
        description={t('empty.description')}
        icon={
          <Icon name="orders" size={28} />
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
                  {formatDate(count.createdAt, locale)}
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
                      style={{ padding: 6, minWidth: 0, color: 'var(--danger)' }}
                      onClick={(e) => handleDelete(e, count.id)}
                      aria-label={tCommon('delete')}
                      title={tCommon('delete')}
                    >
                      <Icon name="trash" size={16} />
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
