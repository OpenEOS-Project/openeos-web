'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from '@untitledui/icons';
import { formatCurrency } from '@/utils/format';
import type { AppliedVoucher } from '@/stores/cart-store';
import type { DiscountVoucher } from '@/types/discount-voucher';
import { PosNumpad } from './cash-payment-modal';

interface DiscountVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: DiscountVoucher[];
  appliedIds: string[];
  onApply: (voucher: AppliedVoucher) => void;
}

export function DiscountVoucherModal({
  isOpen,
  onClose,
  vouchers,
  appliedIds,
  onApply,
}: DiscountVoucherModalProps) {
  const t = useTranslations('pos.discount');
  const [isClosing, setIsClosing] = useState(false);
  // When set, we are entering a manual amount for this voucher.
  const [manualVoucher, setManualVoucher] = useState<DiscountVoucher | null>(null);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setManualVoucher(null);
      setManualValue('');
    }
  }, [isOpen]);

  const manualAmount = useMemo(() => {
    if (!manualValue) return 0;
    return parseInt(manualValue, 10) / 100;
  }, [manualValue]);

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleSelect = (voucher: DiscountVoucher) => {
    if (appliedIds.includes(voucher.id)) return;
    if (voucher.type === 'manual') {
      setManualVoucher(voucher);
      setManualValue('');
      return;
    }
    onApply({ id: voucher.id, name: voucher.name, amount: Number(voucher.amount ?? 0) });
    handleClose();
  };

  const handleManualConfirm = () => {
    if (!manualVoucher || manualAmount <= 0) return;
    onApply({ id: manualVoucher.id, name: manualVoucher.name, amount: manualAmount });
    handleClose();
  };

  if (!isOpen) return null;

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
            {manualVoucher ? manualVoucher.name : t('title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Schließen"
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
          style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {manualVoucher ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--pos-ink-3)' }}>{t('enterAmount')}</div>
              <div
                style={{
                  background: 'var(--pos-surface-2)',
                  border: '1px solid var(--pos-line)',
                  borderRadius: 'var(--pos-r-md)',
                  padding: '12px',
                  textAlign: 'center',
                  fontFamily: 'var(--pos-ff-mono)',
                  fontSize: 26,
                  fontWeight: 700,
                  color: 'var(--pos-ink)',
                }}
              >
                {manualValue ? formatCurrency(manualAmount) : '—'}
              </div>
              <PosNumpad value={manualValue} onChange={setManualValue} maxLength={7} />
            </>
          ) : vouchers.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--pos-ink-3)', fontSize: 13 }}>
              {t('empty')}
            </div>
          ) : (
            vouchers.map((voucher) => {
              const applied = appliedIds.includes(voucher.id);
              return (
                <button
                  key={voucher.id}
                  type="button"
                  onClick={() => handleSelect(voucher)}
                  disabled={applied}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--pos-surface)',
                    border: '1px solid var(--pos-line)',
                    borderRadius: 'var(--pos-r-md)',
                    cursor: applied ? 'default' : 'pointer',
                    opacity: applied ? 0.5 : 1,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pos-ink)' }}>{voucher.name}</span>
                    {voucher.description && (
                      <span style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>{voucher.description}</span>
                    )}
                  </div>
                  <span className="pos-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos-accent-ink)', flexShrink: 0 }}>
                    {applied ? (
                      <Check style={{ width: 18, height: 18 }} />
                    ) : voucher.type === 'manual' ? (
                      t('manualBadge')
                    ) : (
                      `−${formatCurrency(Number(voucher.amount ?? 0))}`
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Manual confirm footer */}
        {manualVoucher && (
          <div style={{ padding: '10px 18px 18px', borderTop: '1px solid var(--pos-line)', background: 'var(--pos-surface)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleManualConfirm}
              disabled={manualAmount <= 0}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 15,
                fontWeight: 700,
                background: manualAmount > 0 ? 'var(--pos-accent)' : 'var(--pos-line)',
                color: manualAmount > 0 ? 'var(--pos-accent-contrast)' : 'var(--pos-ink-3)',
                border: 'none',
                borderRadius: 'var(--pos-r-md)',
                cursor: manualAmount > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Check style={{ width: 20, height: 20 }} />
              {t('apply')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
