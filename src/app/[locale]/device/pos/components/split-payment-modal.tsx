'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, BankNote01, CreditCard01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { useDeviceStore } from '@/stores/device-store';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import { cx } from '@/utils/cx';
import type { Order, OrderItem } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UnpaidItem {
  orderId: string;
  orderNumber: string;
  dailyNumber?: number;
  tableNumber?: string | null;
  item: OrderItem;
  unpaidQuantity: number;
}

type GroupBy = 'order' | 'category';

export function SplitPaymentModal({ isOpen, onClose }: SplitPaymentModalProps) {
  const t = useTranslations('pos.splitPayment');
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Record<string, number>>({});
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('order');
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;

  // Fetch all open orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-open-tabs'],
    queryFn: () => deviceApi.getOpenOrders(),
    enabled: isOpen,
  });

  const orders = ordersData?.data || [];

  // Build flat list of unpaid items from all orders
  const unpaidItems: UnpaidItem[] = useMemo(() => {
    const result: UnpaidItem[] = [];

    for (const order of orders) {
      if (!order.items) continue;

      for (const item of order.items) {
        const unpaidQty = item.quantity - (item.paidQuantity || 0);
        if (unpaidQty <= 0) continue;
        if (item.status === 'cancelled') continue;

        result.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          dailyNumber: order.dailyNumber,
          tableNumber: order.tableNumber,
          item,
          unpaidQuantity: unpaidQty,
        });
      }
    }

    return result;
  }, [orders]);

  // Group unpaid items by order for display
  const groupedByOrder = useMemo(() => {
    const groups: Record<string, { order: Order; items: UnpaidItem[] }> = {};
    for (const ui of unpaidItems) {
      if (!groups[ui.orderId]) {
        const order = orders.find((o) => o.id === ui.orderId)!;
        groups[ui.orderId] = { order, items: [] };
      }
      groups[ui.orderId].items.push(ui);
    }
    return Object.values(groups);
  }, [unpaidItems, orders]);

  // Group unpaid items by category for display
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, { categoryName: string; items: UnpaidItem[] }> = {};
    for (const ui of unpaidItems) {
      const catName = ui.item.categoryName || t('uncategorized');
      if (!groups[catName]) {
        groups[catName] = { categoryName: catName, items: [] };
      }
      groups[catName].items.push(ui);
    }
    return Object.values(groups).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [unpaidItems, t]);

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    return unpaidItems.reduce((total, ui) => {
      const selectedQty = selections[ui.item.id] || 0;
      const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);
      return total + itemPrice * selectedQty;
    }, 0);
  }, [unpaidItems, selections]);

  // Calculate total remaining across all orders
  const totalRemaining = useMemo(() => {
    return orders.reduce((total, order) => {
      return total + (Number(order.total) - Number(order.paidAmount || 0));
    }, 0);
  }, [orders]);

  const hasSelection = selectedTotal > 0;

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelections((prev) => {
      const ui = unpaidItems.find((u) => u.item.id === itemId);
      if (!ui) return prev;

      const current = prev[itemId] || 0;
      const newQty = Math.max(0, Math.min(ui.unpaidQuantity, current + delta));

      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [itemId]: newQty };
    });
  };

  const handleSelectAll = () => {
    const allSelections: Record<string, number> = {};
    unpaidItems.forEach((ui) => {
      allSelections[ui.item.id] = ui.unpaidQuantity;
    });
    setSelections(allSelections);
  };

  const handleSelectAllCategory = (categoryItems: UnpaidItem[]) => {
    setSelections((prev) => {
      const next = { ...prev };
      for (const ui of categoryItems) {
        next[ui.item.id] = ui.unpaidQuantity;
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelections({});
  };

  // Group selected items by orderId for payment
  const getSelectedByOrder = () => {
    const byOrder: Record<string, { orderId: string; items: { orderItemId: string; quantity: number }[]; amount: number }> = {};

    for (const ui of unpaidItems) {
      const selectedQty = selections[ui.item.id] || 0;
      if (selectedQty <= 0) continue;

      if (!byOrder[ui.orderId]) {
        byOrder[ui.orderId] = { orderId: ui.orderId, items: [], amount: 0 };
      }

      const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);
      byOrder[ui.orderId].items.push({
        orderItemId: ui.item.id,
        quantity: selectedQty,
      });
      byOrder[ui.orderId].amount += itemPrice * selectedQty;
    }

    return Object.values(byOrder);
  };

  const paySelectedItems = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      const orderPayments = getSelectedByOrder();

      // Create split payment for each order
      for (const op of orderPayments) {
        await deviceApi.createSplitPayment({
          orderId: op.orderId,
          amount: op.amount,
          paymentMethod,
          items: op.items,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
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

  const renderItemRow = (ui: UnpaidItem) => {
    const selectedQty = selections[ui.item.id] || 0;
    const isSelected = selectedQty > 0;
    const itemPrice = Number(ui.item.unitPrice) + Number(ui.item.optionsPrice || 0);

    return (
      <div
        key={ui.item.id}
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
              {ui.item.productName}
            </p>
            <p className="text-sm text-tertiary">
              {formatCurrency(itemPrice)} × {ui.unpaidQuantity} {t('open')}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              type="button"
              onClick={() => handleQuantityChange(ui.item.id, -1)}
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
              onClick={() => handleQuantityChange(ui.item.id, 1)}
              disabled={selectedQty >= ui.unpaidQuantity}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary hover:bg-secondary disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
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
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            </div>
          ) : unpaidItems.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-tertiary">{t('remaining')}: {formatCurrency(0)}</p>
            </div>
          ) : (
            <>
              {/* Total remaining info */}
              <div className="mb-4 rounded-lg bg-secondary p-3 flex items-center justify-between">
                <p className="font-medium text-primary">
                  {orders.length} {orders.length === 1 ? 'Bestellung' : 'Bestellungen'}
                </p>
                <div className="text-right">
                  <p className="text-sm text-tertiary">{t('remaining')}</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(totalRemaining)}
                  </p>
                </div>
              </div>

              {/* Items List header with grouping toggle */}
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
                      {t('clearSelection')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-brand-primary hover:text-brand-primary/80"
                    >
                      {t('selectAll')}
                    </button>
                  </div>
                </div>

                {/* Grouping toggle */}
                <div className="flex rounded-lg border border-secondary bg-secondary p-0.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setGroupBy('order')}
                    className={cx(
                      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      groupBy === 'order'
                        ? 'bg-primary text-primary shadow-sm'
                        : 'text-tertiary hover:text-primary'
                    )}
                  >
                    {t('groupByOrder')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupBy('category')}
                    className={cx(
                      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      groupBy === 'category'
                        ? 'bg-primary text-primary shadow-sm'
                        : 'text-tertiary hover:text-primary'
                    )}
                  >
                    {t('groupByCategory')}
                  </button>
                </div>

                <div className="space-y-4 max-h-64 overflow-auto">
                  {groupBy === 'order' ? (
                    /* Group by order */
                    groupedByOrder.map(({ order, items }) => (
                      <div key={order.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-tertiary">
                            #{order.dailyNumber || order.orderNumber}
                          </span>
                          {order.tableNumber && (
                            <span className="text-xs text-quaternary">
                              {t('table')} {order.tableNumber}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {items.map(renderItemRow)}
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Group by category */
                    groupedByCategory.map(({ categoryName, items }) => (
                      <div key={categoryName}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-tertiary">
                            {categoryName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllCategory(items)}
                            className="text-xs text-brand-primary hover:text-brand-primary/80"
                          >
                            {t('selectAllCategory')}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {items.map(renderItemRow)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Summary */}
              <div
                className={cx(
                  'rounded-lg p-4 mb-4 transition-colors',
                  hasSelection ? 'bg-success-secondary dark:text-white' : 'bg-secondary'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-primary">{t('selectedAmount')}</span>
                  <span
                    className={cx(
                      'text-2xl font-bold',
                      hasSelection ? 'text-success-primary dark:text-white' : 'text-tertiary'
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
                    {t('payCash')}
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      if (hasSumupReader) {
                        setShowSumupModal(true);
                      } else {
                        handlePay('card');
                      }
                    }}
                    disabled={!hasSelection || isProcessing}
                    iconLeading={CreditCard01}
                  >
                    {t('payCard')}
                  </Button>
                </div>
              </div>
            </>
          )}
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

      {/* SumUp Checkout Modal */}
      <SumUpCheckoutModal
        isOpen={showSumupModal}
        onClose={() => setShowSumupModal(false)}
        amount={selectedTotal}
        onSuccess={() => {
          setShowSumupModal(false);
          handlePay('sumup_terminal' as PaymentMethod);
        }}
      />
    </>
  );
}
