'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useInventoryCounts, useDeleteInventoryCount } from '@/hooks/use-inventory';
import { ListLoading, ListError, ListEmpty } from '@/components/shared/list-states';
import {
  AdminTable,
  CellMain,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import type { InventoryCount, InventoryCountStatus } from '@/types/inventory';

import '@/styles/admin-table-wave2.css';

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

  const handleDelete = async (countId: string) => {
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

  const columns: DataColumn<InventoryCount>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (count) => (
        <CellMain
          title={count.name}
          titleText={count.name}
          sub={count.notes || undefined}
          subText={count.notes || undefined}
        />
      ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (count) => <StatusBadge status={count.status} />,
    },
    {
      id: 'createdAt',
      header: t('table.createdAt'),
      mobile: 'meta',
      className: 'admin-dt__date',
      cell: (count) => formatDate(count.createdAt, locale),
    },
    {
      id: 'itemCount',
      header: t('table.itemCount'),
      num: true,
      mobile: 'trailing',
      cell: (count) => (count.items ? count.items.length : '–'),
    },
    {
      id: 'completedBy',
      header: t('table.completedBy'),
      priority: 2,
      cell: (count) => {
        const name = formatUserName(count.completedByUser);
        return (
          <CellText muted title={name}>
            {name}
          </CellText>
        );
      },
    },
  ];

  // Nur Entwürfe lassen sich löschen.
  const actions = (count: InventoryCount): RowAction[] => [
    {
      id: 'delete',
      label: tCommon('delete'),
      icon: 'trash',
      danger: true,
      hidden: count.status !== 'draft',
      onClick: () => void handleDelete(count.id),
    },
  ];

  return (
    <div className="app-card app-card--flat">
      {/* Nur die Anzahl wie bei Produkten und Geraeten — Titel und
          Untertitel stehen schon im Seitenkopf darueber. */}
      <ListHead actions={<ListAction variant="primary" icon="plus" label={t('create')} onClick={onCreateClick} />}>
        <ListCount>{t('count', { count: counts.length })}</ListCount>
      </ListHead>

      {/* Ein Klick auf die Zeile öffnet die Inventur. */}
      <AdminTable
        caption={t('title')}
        rows={counts}
        rowKey="id"
        columns={columns}
        actions={actions}
        onRowClick={(count) => onSelectCount(count)}
      />
    </div>
  );
}
