'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, BankNote01, CreditCard01, Check } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import { cx } from '@/utils/cx';
import type { Order, OrderItem } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}

interface ItemSelection {
  itemId: string;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  productName: string;
}

export function SplitPaymentModal({ isOpen, onClose, order }: SplitPaymentModalProps) {
  const t = useTranslations('pos.splitPayment');
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [showCashModal, setShowCashModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate unpaid quantity for each item
  const unpaidItems = useMemo(() => {
    if (!order.items) return [];

    return order.items
      .map((item) => {
        const unpaidQty = item.quantity - (item.paidQuantity || 0);
        return {
          ...item,
          unpaidQuantity: unpaidQty,
        };
      })
      .filter((item) => item.unpaidQuantity > 0);
  }, [order.items]);

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    return unpaidItems.reduce((total, item) => {
      const selectedQty = selections[item.id] || 0;
      const itemPrice = Number(item.unitPrice) + Number(item.optionsPrice || 0);
      return total + itemPrice * selectedQty;
    }, 0);
  }, [unpaidItems, selections]);

  // Calculate remaining total
  const remainingTotal = useMemo(() => {
    const orderRemaining = Number(order.total) - Number(order.paidAmount || 0);
    return orderRemaining - selectedTotal;
  }, [order, selectedTotal]);

  const hasSelection = selectedTotal > 0;

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelections((prev) => {
      const item = unpaidItems.find((i) => i.id === itemId);
      if (!item) return prev;

      const current = prev[itemId] || 0;
      const newQty = Math.max(0, Math.min(item.unpaidQuantity, current + delta));

      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [itemId]: newQty };
    });
  };

  const handleSelectAll = () => {
    const allSelections: Record<string, number> = {};
    unpaidItems.forEach((item) => {
      allSelections[item.id] = item.unpaidQuantity;
    });
    setSelections(allSelections);
  };

  const handleClearSelection = () => {
    setSelections({});
  };

  const paySelectedItems = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      // Build items to pay
      const itemsToPay = Object.entries(selections)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({
          orderItemId: itemId,
          quantity,
        }));

      // Create split payment via device API
      await deviceApi.createSplitPayment({
        orderId: order.id,
        amount: selectedTotal,
        paymentMethod,
        items: itemsToPay,
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      setSelections({});
      setShowCashModal(false);
      onClose();
    },
  });

  const handlePay = async (paymentMethod: PaymentMethod) => {
    if (!hasSelection) return;

    setIsProcessing(true);
    try {
      await paySelectedItems.mutateAsync(paymentMethod);
    } catch (error) {
      console.error('Split payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashClick = () => {
    if (!hasSelection) return;
    setShowCashModal(true);
  };

  const handleCashConfirm = () => {
    handlePay('cash');
  };

  return (
    <>
      <DialogModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('title')}
        size="lg"
      >
        <div className="p-6">
          {/* Order Info */}
          <div className="mb-4 rounded-lg bg-secondary p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-primary">
                #{order.dailyNumber || order.orderNumber}
                {order.tableNumber && (
                  <span className="ml-2 text-tertiary">
                    Tisch {order.tableNumber}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-tertiary">{t('remaining')}</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(Number(order.total) - Number(order.paidAmount || 0))}
              </p>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-tertiary">{t('selectItems')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-tertiary hover:text-primary"
                  disabled={!hasSelection}
                >
                  Auswahl löschen
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-brand-primary hover:text-brand-primary/80"
                >
                  Alle auswählen
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {unpaidItems.map((item) => {
                const selectedQty = selections[item.id] || 0;
                const isSelected = selectedQty > 0;
                const itemPrice = Number(item.unitPrice) + Number(item.optionsPrice || 0);

                return (
                  <div
                    key={item.id}
                    className={cx(
                      'rounded-lg border p-3 transition-colors',
                      isSelected
                        ? 'border-brand-primary bg-brand-primary_alt'
                        : 'border-secondary bg-primary'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-primary truncate">
                          {item.productName}
                        </p>
                        <p className="text-sm text-tertiary">
                          {formatCurrency(itemPrice)} × {item.unpaidQuantity} offen
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={selectedQty === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary hover:bg-secondary disabled:opacity-50"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium text-primary">
                          {selectedQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          disabled={selectedQty >= item.unpaidQuantity}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary hover:bg-secondary disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Summary */}
          <div
            className={cx(
              'rounded-lg p-4 mb-4 transition-colors',
              hasSelection ? 'bg-success-secondary' : 'bg-secondary'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">{t('selectedAmount')}</span>
              <span
                className={cx(
                  'text-2xl font-bold',
                  hasSelection ? 'text-success-primary' : 'text-tertiary'
                )}
              >
                {formatCurrency(selectedTotal)}
              </span>
            </div>
          </div>

          {/* Payment Actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                color="secondary"
                size="lg"
                onClick={handleCashClick}
                disabled={!hasSelection || isProcessing}
                iconLeading={BankNote01}
              >
                Bar
              </Button>
              <Button
                size="lg"
                onClick={() => handlePay('card')}
                disabled={!hasSelection || isProcessing}
                iconLeading={CreditCard01}
              >
                Karte
              </Button>
            </div>
          </div>
        </div>
      </DialogModal>

      {/* Cash Payment Modal */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={selectedTotal}
        onConfirm={handleCashConfirm}
        isProcessing={isProcessing}
      />
    </>
  );
}
