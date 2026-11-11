'use client';

import { useTranslations } from 'next-intl';
import { Icon, type DataColumn } from '@openeos/ui';
import { ArrowLeft } from 'lucide-react';
import { useIntlLocale } from '@/hooks/use-locale-format';

import { useInventoryCount } from '@/hooks/use-inventory';
import { AdminTable, CellMain, CellText } from '@/components/shared/admin-table';
import type { InventoryCount, InventoryCountItem } from '@/types/inventory';

import '@/styles/admin-table-wave2.css';

interface InventoryCompletedViewProps {
  eventId: string;
  count: InventoryCount;
  onBack: () => void;
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUserName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return '–';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || '–';
}

export function InventoryCompletedView({
  eventId,
  count: initialCount,
  onBack,
}: InventoryCompletedViewProps) {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const locale = useIntlLocale();

  const { data: count } = useInventoryCount(eventId, initialCount.id);
  const resolvedCount = count ?? initialCount;

  const items = [...(resolvedCount.items ?? [])].sort(
    (a, b) => (a.countedQuantity ?? 0) - (b.countedQuantity ?? 0),
  );

  const diffOf = (item: InventoryCountItem) =>
    item.countedQuantity !== null ? item.countedQuantity - item.expectedQuantity : null;

  const itemColumns: DataColumn<InventoryCountItem>[] = [
    {
      id: 'product',
      header: t('table.product'),
      mobile: 'title',
      cell: (item) => {
        const name = item.product?.name ?? item.productId;
        return <CellMain title={name} titleText={name} />;
      },
    },
    {
      id: 'expected',
      header: t('table.expected'),
      num: true,
      cell: (item) => item.expectedQuantity,
    },
    {
      id: 'counted',
      header: t('table.counted'),
      num: true,
      cell: (item) =>
        item.countedQuantity !== null ? item.countedQuantity : <span className="admin-cell-none">–</span>,
    },
    {
      id: 'difference',
      header: t('table.difference'),
      num: true,
      mobile: 'trailing',
      cell: (item) => {
        const diff = diffOf(item);
        if (diff === null) return <span className="admin-cell-none">–</span>;
        return (
          <span className="inventory-diff" data-tone={diff < 0 ? 'minus' : diff > 0 ? 'plus' : 'zero'}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        );
      },
    },
    {
      // Telefon: Gezählt und Erwartet mit Beschriftung in Zeile 2.
      id: 'quantities',
      header: t('table.counted'),
      mobile: 'subtitle',
      className: 'admin-dt__phone-only',
      cell: (item) =>
        `${t('table.counted')} ${item.countedQuantity ?? '–'} / ${t('table.expected')} ${item.expectedQuantity}`,
    },
    {
      id: 'notes',
      header: t('table.notes'),
      mobile: 'meta',
      cell: (item) =>
        item.notes ? (
          <CellText muted title={item.notes}>
            {item.notes}
          </CellText>
        ) : null,
    },
  ];

  const handleExportCsv = () => {
    const header = `${t('csv.product')};${t('csv.counted')};${t('csv.difference')};${t('csv.notes')}`;
    const rows = items.map((item) => {
      const name = (item.product?.name ?? item.productId).replace(/;/g, ',');
      const counted = item.countedQuantity !== null ? item.countedQuantity : '';
      const diff = item.countedQuantity !== null ? item.countedQuantity - item.expectedQuantity : '';
      const notes = (item.notes ?? '').replace(/;/g, ',');
      return `${name};${counted};${diff};${notes}`;
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resolvedCount.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Nachkaufliste.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="app-card" style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onBack}
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={16} />
              {tCommon('back')}
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{resolvedCount.name}</span>
                <span className="badge badge--success">{t('status.completed')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginTop: 2 }}>
                {t('completed.completedAt')}: {formatDate(resolvedCount.completedAt, locale)}
                {resolvedCount.completedByUser && (
                  <> &middot; {formatUserName(resolvedCount.completedByUser)}</>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleExportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="download" size={16} />
            {t('completed.exportCsv')}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className="app-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t('completed.totalItems')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{items.length}</div>
        </div>
        <div className="app-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t('completed.countedItems')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {items.filter((i) => i.countedQuantity !== null).length}
          </div>
        </div>
        <div className="app-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t('completed.itemsWithDiff')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>
            {items.filter((i) => i.countedQuantity !== null && i.countedQuantity !== i.expectedQuantity).length}
          </div>
        </div>
        <div className="app-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{t('completed.totalDiff')}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {(() => {
              const total = items.reduce((sum, i) => sum + ((i.countedQuantity ?? i.expectedQuantity) - i.expectedQuantity), 0);
              return total > 0 ? `+${total}` : total;
            })()}
          </div>
        </div>
      </div>

      {/* Items table — sorted by countedQuantity ASC (Nachkaufliste) */}
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('completed.listTitle')}</h2>
            <p className="app-card__sub">{t('completed.listSubtitle')}</p>
          </div>
        </div>
        <AdminTable
          caption={t('completed.listTitle')}
          rows={items}
          rowKey="id"
          columns={itemColumns}
          empty={t('empty.noItems')}
        />
      </div>
    </div>
  );
}
