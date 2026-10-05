'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from '@untitledui/icons';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { AppliedVoucher } from '@/stores/cart-store';
import type { DiscountVoucher } from '@/types/discount-voucher';
import { PosNumpad } from './cash-payment-modal';
import { PosSheet, usePosSheetClose } from './pos-sheet';

interface DiscountVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: DiscountVoucher[];
  appliedIds: string[];
  onApply: (voucher: Omit<AppliedVoucher, 'uid'>) => void;
}

export function DiscountVoucherModal({
  isOpen,
  onClose,
  vouchers,
  appliedIds,
  onApply,
}: DiscountVoucherModalProps) {
  const t = useTranslations('pos.discount');
  const formatCurrency = useFormatPrice();
  // When set, we are entering a manual amount for this voucher.
  const [manualVoucher, setManualVoucher] = useState<DiscountVoucher | null>(null);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setManualVoucher(null);
      setManualValue('');
    }
  }, [isOpen]);

  const manualAmount = useMemo(() => {
    if (!manualValue) return 0;
    return parseInt(manualValue, 10) / 100;
  }, [manualValue]);

  const { closing, close: handleClose } = usePosSheetClose(isOpen, onClose);

  const handleSelect = (voucher: DiscountVoucher) => {
    // Multi-use vouchers stay selectable even when already applied.
    if (appliedIds.includes(voucher.id) && !voucher.allowMultiplePerOrder) return;
    if (voucher.type === 'manual') {
      setManualVoucher(voucher);
      setManualValue('');
      return;
    }
    onApply({
      id: voucher.id,
      name: voucher.name,
      amount: Number(voucher.amount ?? 0),
      allowMultiple: voucher.allowMultiplePerOrder,
    });
    handleClose();
  };

  const handleManualConfirm = () => {
    if (!manualVoucher || manualAmount <= 0) return;
    onApply({
      id: manualVoucher.id,
      name: manualVoucher.name,
      amount: manualAmount,
      allowMultiple: manualVoucher.allowMultiplePerOrder,
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <PosSheet
      closing={closing}
      onClose={handleClose}
      title={manualVoucher ? manualVoucher.name : t('title')}
      footer={
        manualVoucher ? (
          <button
            type="button"
            className="pos-btn pos-btn--primary"
            style={{ width: '100%' }}
            onClick={handleManualConfirm}
            disabled={manualAmount <= 0}
          >
            <Check />
            {t('apply')}
          </button>
        ) : undefined
      }
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
        <div className="pos-sheet-empty">{t('empty')}</div>
      ) : (
        vouchers.map((voucher) => {
          // Multi-use vouchers never appear "used up".
          const applied = appliedIds.includes(voucher.id) && !voucher.allowMultiplePerOrder;
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
    </PosSheet>
  );
}
