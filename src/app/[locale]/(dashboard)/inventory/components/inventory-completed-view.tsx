'use client';

import { useTranslations } from 'next-intl';

import { useInventoryCount } from '@/hooks/use-inventory';
import type { InventoryCount } from '@/types/inventory';

interface InventoryCompletedViewProps {
  eventId: string;
  count: InventoryCount;
  onBack: () => void;
}

function formatDate(iso: string | null) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
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

  const { data: count } = useInventoryCount(eventId, initialCount.id);
  const resolvedCount = count ?? initialCount;

  const items = [...(resolvedCount.items ?? [])].sort(
    (a, b) => (a.countedQuantity ?? 0) - (b.countedQuantity ?? 0),
  );

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              {tCommon('back')}
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{resolvedCount.name}</span>
                <span className="badge badge--success">{t('status.completed')}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginTop: 2 }}>
                {t('completed.completedAt')}: {formatDate(resolvedCount.completedAt)}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
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
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>
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
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.product')}</th>
                <th className="text-right">{t('table.expected')}</th>
                <th className="text-right">{t('table.counted')}</th>
                <th className="text-right">{t('table.difference')}</th>
                <th>{t('table.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink)', opacity: 0.5 }}>
                    {t('empty.noItems')}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const diff =
                    item.countedQuantity !== null
                      ? item.countedQuantity - item.expectedQuantity
                      : null;
                  const diffColor = diff === null ? undefined : diff < 0 ? '#dc2626' : diff > 0 ? '#16a34a' : undefined;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {item.product?.name ?? item.productId}
                        </div>
                      </td>
                      <td className="text-right mono" style={{ fontSize: 13 }}>
                        {item.expectedQuantity}
                      </td>
                      <td className="text-right mono" style={{ fontSize: 13 }}>
                        {item.countedQuantity !== null ? item.countedQuantity : <span style={{ opacity: 0.4 }}>–</span>}
                      </td>
                      <td className="text-right mono" style={{ fontSize: 13, color: diffColor, fontWeight: diff !== null && diff !== 0 ? 600 : undefined }}>
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff) : <span style={{ opacity: 0.4 }}>–</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.6 }}>
                        {item.notes ?? ''}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
