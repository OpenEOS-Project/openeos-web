'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

import {
  useInventoryCount,
  useUpdateInventoryItem,
  useCancelInventoryCount,
  useCompleteInventoryCount,
} from '@/hooks/use-inventory';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { InventoryCount, InventoryCountItem } from '@/types/inventory';

import { InventoryCompletedView } from './inventory-completed-view';

interface InventoryCountViewProps {
  eventId: string;
  count: InventoryCount;
  onBack: () => void;
  onCountUpdated: (count: InventoryCount) => void;
}

function DiffCell({ expected, counted }: { expected: number; counted: number | null }) {
  if (counted === null) return <span style={{ opacity: 0.4 }}>–</span>;
  const diff = counted - expected;
  const color = diff < 0 ? 'var(--danger)' : diff > 0 ? '#16a34a' : 'var(--ink)';
  return (
    <span style={{ color, fontWeight: diff !== 0 ? 600 : 400 }}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

interface ItemRowProps {
  item: InventoryCountItem;
  eventId: string;
  countId: string;
  readOnly: boolean;
}

function ItemRow({ item, eventId, countId, readOnly }: ItemRowProps) {
  const [counted, setCounted] = useState<string>(
    item.countedQuantity !== null ? String(item.countedQuantity) : '',
  );
  const [notes, setNotes] = useState<string>(item.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const updateItem = useUpdateInventoryItem(eventId);

  const save = useCallback(
    async (newCounted: string, newNotes: string) => {
      const qty = parseFloat(newCounted);
      if (isNaN(qty)) return;
      setIsSaving(true);
      try {
        await updateItem.mutateAsync({
          countId,
          itemId: item.id,
          data: { countedQuantity: qty, notes: newNotes || undefined },
        });
      } catch {
        // handled by mutation
      } finally {
        setIsSaving(false);
      }
    },
    [countId, item.id, updateItem],
  );

  const handleCountedBlur = () => save(counted, notes);
  const handleCountedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };
  const handleNotesBlur = () => save(counted, notes);

  const currentCounted = parseFloat(counted);
  const diff = !isNaN(currentCounted) ? currentCounted - item.expectedQuantity : null;

  return (
    <tr style={{ opacity: isSaving ? 0.6 : 1 }}>
      <td>
        <div style={{ fontWeight: 500, fontSize: 13 }}>
          {item.product?.name ?? item.productId}
        </div>
      </td>
      <td className="text-right mono" style={{ fontSize: 13 }}>
        {item.expectedQuantity}
      </td>
      <td style={{ width: 120 }}>
        {readOnly ? (
          <span className="mono" style={{ fontSize: 13 }}>
            {item.countedQuantity !== null ? item.countedQuantity : '–'}
          </span>
        ) : (
          <input
            type="number"
            min="0"
            step="1"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            onBlur={handleCountedBlur}
            onKeyDown={handleCountedKeyDown}
            placeholder="0"
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid color-mix(in oklab, var(--ink) 15%, transparent)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              textAlign: 'right',
            }}
          />
        )}
      </td>
      <td className="text-right mono" style={{ fontSize: 13 }}>
        {readOnly ? (
          <DiffCell expected={item.expectedQuantity} counted={item.countedQuantity} />
        ) : (
          <DiffCell
            expected={item.expectedQuantity}
            counted={diff !== null ? currentCounted : null}
          />
        )}
      </td>
      <td style={{ width: 200 }}>
        {readOnly ? (
          <span style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.6 }}>{item.notes ?? ''}</span>
        ) : (
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="–"
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid color-mix(in oklab, var(--ink) 15%, transparent)',
              background: 'var(--paper)',
              color: 'var(--ink)',
            }}
          />
        )}
      </td>
    </tr>
  );
}

export function InventoryCountView({
  eventId,
  count: initialCount,
  onBack,
  onCountUpdated,
}: InventoryCountViewProps) {
  const t = useTranslations('inventory');
  const tCommon = useTranslations('common');

  const { data: count } = useInventoryCount(eventId, initialCount.id);
  const resolvedCount = count ?? initialCount;

  const cancelCount = useCancelInventoryCount(eventId);
  const completeCount = useCompleteInventoryCount(eventId);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const items = resolvedCount.items ?? [];
  const countedItems = items.filter((i) => i.countedQuantity !== null);
  const uncountedItems = items.filter((i) => i.countedQuantity === null);
  const itemsWithDiff = items.filter(
    (i) => i.countedQuantity !== null && i.countedQuantity !== i.expectedQuantity,
  );

  const isInProgress = resolvedCount.status === 'in_progress';
  const isCompleted = resolvedCount.status === 'completed';
  const isCancelled = resolvedCount.status === 'cancelled';
  const readOnly = !isInProgress;

  const handleCancel = async () => {
    setIsActing(true);
    try {
      const updated = await cancelCount.mutateAsync(resolvedCount.id);
      setShowCancelConfirm(false);
      onCountUpdated(updated);
    } catch {
      // handled
    } finally {
      setIsActing(false);
    }
  };

  const handleComplete = async () => {
    setIsActing(true);
    try {
      const updated = await completeCount.mutateAsync(resolvedCount.id);
      setShowCompleteConfirm(false);
      onCountUpdated(updated);
    } catch {
      // handled
    } finally {
      setIsActing(false);
    }
  };

  if (isCompleted) {
    return (
      <InventoryCompletedView
        eventId={eventId}
        count={resolvedCount}
        onBack={onBack}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
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
              <div style={{ fontWeight: 600, fontSize: 15 }}>{resolvedCount.name}</div>
              {resolvedCount.notes && (
                <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{resolvedCount.notes}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Progress indicator */}
            {isInProgress && (
              <div style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7 }}>
                <span style={{ fontWeight: 600 }}>{countedItems.length}</span>
                {' '}{t('progress.of')}{' '}
                <span style={{ fontWeight: 600 }}>{items.length}</span>
                {' '}{t('progress.counted')}
              </div>
            )}

            {isCancelled && (
              <span className="badge badge--error">{t('status.cancelled')}</span>
            )}

            {isInProgress && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowCompleteConfirm(true)}
                >
                  {t('actions.complete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {isInProgress && items.length > 0 && (
        <div style={{ height: 4, borderRadius: 2, background: 'color-mix(in oklab, var(--ink) 10%, transparent)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              background: 'var(--green-ink)',
              width: `${Math.round((countedItems.length / items.length) * 100)}%`,
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}

      {/* Items table */}
      <div className="app-card app-card--flat">
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
                items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    eventId={eventId}
                    countId={resolvedCount.id}
                    readOnly={readOnly}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel confirm modal */}
      {showCancelConfirm && (
        <div className="modal__overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal__panel modal__panel--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('cancelConfirm.title')}</h2>
              <DialogCloseButton onClick={() => setShowCancelConfirm(false)} />
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7, margin: 0 }}>
                {t('cancelConfirm.message')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setShowCancelConfirm(false)} disabled={isActing}>
                {tCommon('back')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleCancel}
                disabled={isActing}
              >
                {isActing ? '...' : t('actions.cancelConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete confirm modal */}
      {showCompleteConfirm && (
        <div className="modal__overlay" onClick={() => setShowCompleteConfirm(false)}>
          <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('completeConfirm.title')}</h2>
              <DialogCloseButton onClick={() => setShowCompleteConfirm(false)} />
            </div>
            <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ opacity: 0.6 }}>{t('completeConfirm.counted')}: </span>
                  <strong>{countedItems.length} / {items.length}</strong>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ opacity: 0.6 }}>{t('completeConfirm.withDiff')}: </span>
                  <strong>{itemsWithDiff.length}</strong>
                </div>
              </div>

              {uncountedItems.length > 0 && (
                <div style={{ padding: '10px 12px', background: 'color-mix(in oklab, var(--warn) 12%, transparent)', borderRadius: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {t('completeConfirm.uncountedWarning', { count: uncountedItems.length })}
                  </div>
                </div>
              )}

              {itemsWithDiff.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}>
                    {t('completeConfirm.diffList')}
                  </div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{t('table.product')}</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('table.expected')}</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('table.counted')}</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('table.difference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsWithDiff.map((item) => {
                        const diff = (item.countedQuantity ?? 0) - item.expectedQuantity;
                        return (
                          <tr key={item.id}>
                            <td style={{ padding: '4px 8px' }}>{item.product?.name ?? item.productId}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.expectedQuantity}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.countedQuantity}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: diff < 0 ? 'var(--danger)' : '#16a34a', fontWeight: 600 }}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.7, margin: 0 }}>
                {t('completeConfirm.message')}
              </p>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setShowCompleteConfirm(false)} disabled={isActing}>
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleComplete}
                disabled={isActing}
              >
                {isActing ? '...' : t('actions.completeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
