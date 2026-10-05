'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Minus, Plus } from '@untitledui/icons';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import type { PfandType } from '@/types/pfand';
import type { CartPfandReturnLine } from '@/stores/cart-store';
import { PosSheet, usePosSheetClose } from './pos-sheet';

interface PfandReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  pfandTypes: PfandType[];
  eventId?: string;
  onSubmitted?: (totalAmount: number) => void;
  /** When true, an active sale exists, so the return can be offset against the
   *  bill ("Verrechnen") instead of paid out in cash. */
  allowOffset?: boolean;
  /** Pre-fill the counters from an already-staged offset. */
  initialCounts?: Record<string, number>;
  /** Called when the user offsets the return against the current sale. */
  onOffset?: (lines: CartPfandReturnLine[]) => void;
}

export function PfandReturnModal({
  isOpen,
  onClose,
  pfandTypes,
  eventId,
  onSubmitted,
  allowOffset = false,
  initialCounts,
  onOffset,
}: PfandReturnModalProps) {
  const t = useTranslations('pos.pfand');
  const formatCurrency = useFormatPrice();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCounts(initialCounts ?? {});
      setIsSubmitting(false);
    }
  }, [isOpen, initialCounts]);

  const setQty = (id: string, qty: number) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  };

  const total = pfandTypes.reduce(
    (sum, pt) => sum + Number(pt.amount) * (counts[pt.id] || 0),
    0,
  );

  const { closing, close: handleClose } = usePosSheetClose(isOpen, onClose);

  const handlePayout = async () => {
    const lines = pfandTypes
      .filter((pt) => (counts[pt.id] || 0) > 0)
      .map((pt) => ({ pfandTypeId: pt.id, quantity: counts[pt.id] }));
    if (lines.length === 0) return;
    setIsSubmitting(true);
    try {
      await deviceApi.createPfandReturn({ ...(eventId ? { eventId } : {}), lines });
      onSubmitted?.(total);
      handleClose();
    } catch (error) {
      console.error('Pfand return failed:', error);
      setIsSubmitting(false);
    }
  };

  // Offset the counted return against the current sale instead of paying cash.
  const handleOffset = () => {
    const lines: CartPfandReturnLine[] = pfandTypes
      .filter((pt) => (counts[pt.id] || 0) > 0)
      .map((pt) => ({
        pfandTypeId: pt.id,
        name: pt.name,
        unitAmount: Number(pt.amount),
        quantity: counts[pt.id],
      }));
    onOffset?.(lines);
  };

  if (!isOpen) return null;

  return (
    <PosSheet
      closing={closing}
      onClose={handleClose}
      title={t('returnTitle')}
      bodyStyle={{ gap: 10 }}
      footer={
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink)' }}>{t('returnSum')}</span>
            <span className="pos-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--pos-ink)' }}>
              {formatCurrency(total)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {allowOffset && (
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                style={{ flex: 1 }}
                onClick={handleOffset}
                disabled={total <= 0}
              >
                <Check />
                {t('offsetButton')}
              </button>
            )}
            {/* Mit offenem Verkauf ist Verrechnen die Hauptaktion, Auszahlen
                tritt zurueck. */}
            <button
              type="button"
              className={`pos-btn ${allowOffset ? 'pos-btn--secondary' : 'pos-btn--primary'}`}
              style={{ flex: 1 }}
              onClick={handlePayout}
              disabled={total <= 0 || isSubmitting}
            >
              {!allowOffset && <Check />}
              {isSubmitting ? '…' : t('payoutButton')}
            </button>
          </div>
          {allowOffset && (
            <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--pos-ink-3)', textAlign: 'center' }}>
              {t('offsetHint')}
            </p>
          )}
        </>
      }
    >
      {pfandTypes.length === 0 ? (
        <div className="pos-sheet-empty">{t('empty')}</div>
      ) : (
        pfandTypes.map((pt) => {
          const qty = counts[pt.id] || 0;
          return (
            <div
              key={pt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 12px',
                background: 'var(--pos-surface)',
                border: '1px solid var(--pos-line)',
                borderRadius: 'var(--pos-r-md)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pos-ink)' }}>{pt.name}</span>
                <span className="pos-mono" style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>
                  {formatCurrency(Number(pt.amount))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="pos-qty-btn" onClick={() => setQty(pt.id, qty - 1)} aria-label={t('decrease')}>
                  <Minus />
                </button>
                <span className="pos-mono" style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--pos-ink)' }}>
                  {qty}
                </span>
                <button type="button" className="pos-qty-btn" onClick={() => setQty(pt.id, qty + 1)} aria-label={t('increase')}>
                  <Plus />
                </button>
              </div>
            </div>
          );
        })
      )}
    </PosSheet>
  );
}
