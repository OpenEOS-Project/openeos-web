'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useUpdateProductStock } from '@/hooks/use-products';
import type { Product } from '@/types/product';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  eventId: string;
  product: Product | null;
  onClose: () => void;
}

export function StockAdjustmentModal({
  isOpen,
  eventId,
  product,
  onClose,
}: StockAdjustmentModalProps) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');

  const [adjustmentValue, setAdjustmentValue] = useState<string>('');
  const [reason, setReason] = useState('');

  const updateStock = useUpdateProductStock();

  const handleClose = () => {
    setAdjustmentValue('');
    setReason('');
    onClose();
  };

  const handleAdjust = async (type: 'add' | 'subtract') => {
    if (!product || !eventId) return;

    const quantity = parseInt(adjustmentValue, 10);
    if (isNaN(quantity) || quantity <= 0) return;

    const adjustedQuantity = type === 'add' ? quantity : -quantity;

    try {
      await updateStock.mutateAsync({
        eventId,
        id: product.id,
        quantity: adjustedQuantity,
        reason: reason || undefined,
      });
      handleClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  if (!product || !isOpen) return null;

  const adjustmentNum = parseInt(adjustmentValue, 10) || 0;
  const newStockAfterAdd = product.stockQuantity + adjustmentNum;
  const newStockAfterSubtract = product.stockQuantity - adjustmentNum;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{t('stock.title')}</h2>
          <button type="button" className="modal__close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Product Info */}
          <div style={{
            borderRadius: 10, background: 'color-mix(in oklab, var(--ink) 5%, transparent)',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{product.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>
                {product.stockQuantity}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink)', opacity: 0.55 }}>{product.stockUnit}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginTop: 2 }}>{t('stock.currentStock')}</div>
          </div>

          {/* Adjustment Input */}
          <label className="auth-field">
            <span>{t('stock.adjustmentAmount')}</span>
            <input
              type="number"
              placeholder="0"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
            />
          </label>

          {/* Reason */}
          <label className="auth-field">
            <span>{t('stock.reason')}</span>
            <input
              type="text"
              placeholder={t('stock.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          {/* Preview */}
          {adjustmentNum > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginBottom: 4 }}>{t('stock.afterAdd')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-ink)', fontFamily: 'var(--f-mono)' }}>
                  {newStockAfterAdd} {product.stockUnit}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5, marginBottom: 4 }}>{t('stock.afterSubtract')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--f-mono)', color: newStockAfterSubtract < 0 ? '#d24545' : '#c07a00' }}>
                  {newStockAfterSubtract} {product.stockUnit}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal__foot" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={updateStock.isPending}>
            {tCommon('cancel')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ color: '#d24545' }}
              onClick={() => handleAdjust('subtract')}
              disabled={updateStock.isPending || adjustmentNum <= 0 || newStockAfterSubtract < 0}
            >
              − {t('stock.subtract')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => handleAdjust('add')}
              disabled={updateStock.isPending || adjustmentNum <= 0}
            >
              + {t('stock.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
