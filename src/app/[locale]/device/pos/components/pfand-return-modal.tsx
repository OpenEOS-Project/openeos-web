'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Minus, Plus, X } from '@untitledui/icons';
import { formatCurrency } from '@/utils/format';
import { deviceApi } from '@/lib/api-client';
import type { PfandType } from '@/types/pfand';
import type { CartPfandReturnLine } from '@/stores/cart-store';

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
  const tCommon = useTranslations('common');
  const [isClosing, setIsClosing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
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

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

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

  const counterBtn: React.CSSProperties = {
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--pos-surface-2)',
    border: '1px solid var(--pos-line)',
    borderRadius: 'var(--pos-r-sm)',
    cursor: 'pointer',
    color: 'var(--pos-ink)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 50 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,18,12,.45)',
          opacity: isClosing ? 0 : 1,
          transition: 'opacity .2s ease',
        }}
      />

      <div
        className="pos-sheet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '92%',
          background: 'var(--pos-surface)',
          borderTopLeftRadius: 'var(--pos-r-lg)',
          borderTopRightRadius: 'var(--pos-r-lg)',
          boxShadow: 'var(--pos-sh-3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isClosing ? 'translateY(100%)' : undefined,
          transition: 'transform .22s ease',
          animation: isClosing ? undefined : 'pos-slide-up-sheet .22s ease',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 28, flexShrink: 0 }}>
          <div style={{ width: 48, height: 5, background: 'var(--pos-line-strong)', borderRadius: 999 }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px 12px',
            borderBottom: '1px solid var(--pos-line)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--pos-ink)', letterSpacing: '-0.01em' }}>
            {t('returnTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={tCommon('close')}
            style={{
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--pos-ink-3)',
              borderRadius: 'var(--pos-r-sm)',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* Body */}
        <div
          className="pos-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {pfandTypes.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--pos-ink-3)', fontSize: 13 }}>
              {t('empty')}
            </div>
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
                    <button type="button" style={counterBtn} onClick={() => setQty(pt.id, qty - 1)} aria-label={t('decrease')}>
                      <Minus style={{ width: 16, height: 16 }} />
                    </button>
                    <span className="pos-mono" style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--pos-ink)' }}>
                      {qty}
                    </span>
                    <button type="button" style={counterBtn} onClick={() => setQty(pt.id, qty + 1)} aria-label={t('increase')}>
                      <Plus style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px 18px', borderTop: '1px solid var(--pos-line)', background: 'var(--pos-surface)', flexShrink: 0 }}>
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
                onClick={handleOffset}
                disabled={total <= 0}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  fontSize: 15,
                  fontWeight: 700,
                  background: total > 0 ? 'var(--pos-accent)' : 'var(--pos-line)',
                  color: total > 0 ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
                  border: 'none',
                  borderRadius: 'var(--pos-r-md)',
                  cursor: total > 0 ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Check style={{ width: 20, height: 20 }} />
                {t('offsetButton')}
              </button>
            )}
            <button
              type="button"
              onClick={handlePayout}
              disabled={total <= 0 || isSubmitting}
              style={{
                flex: 1,
                padding: '14px 12px',
                fontSize: 15,
                fontWeight: 700,
                background: allowOffset
                  ? 'transparent'
                  : total > 0
                  ? 'var(--pos-accent)'
                  : 'var(--pos-line)',
                color: allowOffset
                  ? total > 0
                    ? 'var(--pos-ink)'
                    : 'var(--pos-ink-3)'
                  : total > 0
                  ? 'var(--pos-accent-contrast)'
                  : 'var(--pos-ink-3)',
                border: allowOffset ? '1px solid var(--pos-line-strong)' : 'none',
                borderRadius: 'var(--pos-r-md)',
                cursor: total > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {!allowOffset && <Check style={{ width: 20, height: 20 }} />}
              {isSubmitting ? '…' : t('payoutButton')}
            </button>
          </div>
          {allowOffset && (
            <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--pos-ink-3)', textAlign: 'center' }}>
              {t('offsetHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
