'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { NumPad } from './num-pad';
import { formatCurrency } from '@/utils/format';
import { cx } from '@/utils/cx';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export function CashPaymentModal({
  isOpen,
  onClose,
  total,
  onConfirm,
  isProcessing = false,
}: CashPaymentModalProps) {
  const t = useTranslations('pos.cashPayment');
  const [receivedInput, setReceivedInput] = useState('');

  // Parse received amount (input is in cents format, e.g., "1000" = 10.00)
  const receivedAmount = useMemo(() => {
    if (!receivedInput) return 0;
    return parseInt(receivedInput, 10) / 100;
  }, [receivedInput]);

  const change = useMemo(() => {
    return Math.max(0, receivedAmount - total);
  }, [receivedAmount, total]);

  const canConfirm = receivedAmount >= total;

  // Quick amount buttons - round up to common values
  const quickAmounts = useMemo(() => {
    const amounts: number[] = [];
    const roundedTotal = Math.ceil(total);

    // Add exact amount
    amounts.push(total);

    // Add rounded amounts
    if (roundedTotal !== total) {
      amounts.push(roundedTotal);
    }

    // Add common round amounts above total
    const commonAmounts = [5, 10, 20, 50, 100];
    for (const amount of commonAmounts) {
      if (amount > total && !amounts.includes(amount)) {
        amounts.push(amount);
      }
      if (amounts.length >= 5) break;
    }

    return amounts.slice(0, 5);
  }, [total]);

  const handleQuickAmount = (amount: number) => {
    // Convert to cents string
    setReceivedInput(Math.round(amount * 100).toString());
  };

  const handleNumPadChange = (value: string) => {
    // Limit to reasonable amount (max 99999.99)
    if (value.length <= 7) {
      setReceivedInput(value);
    }
  };

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  // Reset when modal opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setReceivedInput('');
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={() => handleOpenChange(false)}
      title={t('title')}
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Amount Due */}
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm text-tertiary mb-1">{t('amountDue')}</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handleQuickAmount(amount)}
              className={cx(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                receivedAmount === amount
                  ? 'border-brand-primary bg-brand-secondary text-brand-primary'
                  : 'border-primary bg-primary text-primary hover:bg-secondary'
              )}
            >
              {formatCurrency(amount)}
            </button>
          ))}
        </div>

        {/* Received Amount Display */}
        <div className="text-center">
          <p className="text-sm text-tertiary mb-2">{t('received')}</p>
          <div className="rounded-lg border border-secondary bg-primary py-3 px-4">
            <span className="text-3xl font-bold text-primary tabular-nums">
              {receivedInput ? formatCurrency(receivedAmount) : '—'}
            </span>
          </div>
        </div>

        {/* NumPad */}
        <NumPad
          value={receivedInput}
          onChange={handleNumPadChange}
          maxLength={7}
        />

        {/* Change Display */}
        <div className={cx(
          'rounded-lg p-4 text-center transition-colors',
          canConfirm ? 'bg-success-secondary' : 'bg-secondary'
        )}>
          <p className="text-sm text-tertiary mb-1">{t('change')}</p>
          <p className={cx(
            'text-3xl font-bold',
            canConfirm ? 'text-success-primary' : 'text-tertiary'
          )}>
            {formatCurrency(change)}
          </p>
        </div>

        {/* Confirm Button */}
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm || isProcessing}
          isLoading={isProcessing}
          className="w-full"
          size="lg"
          iconLeading={Check}
        >
          {t('confirm')}
        </Button>
      </div>
    </DialogModal>
  );
}
