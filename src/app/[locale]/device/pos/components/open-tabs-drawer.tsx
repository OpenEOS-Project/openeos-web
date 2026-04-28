'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, BankNote01, CreditCard01, Scissors01 } from '@untitledui/icons';
import { cx } from '@/utils/cx';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { useDeviceStore } from '@/stores/device-store';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import { SumUpCheckoutModal } from './sumup-checkout-modal';
import type { Order } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface OpenTabsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSplitPayment: () => void;
}

export function OpenTabsDrawer({ isOpen, onClose, onSplitPayment }: OpenTabsDrawerProps) {
  const t = useTranslations('pos.openTabs');
  const queryClient = useQueryClient();

  const [showCashModal, setShowCashModal] = useState(false);
  const [showSumupModal, setShowSumupModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { settings } = useDeviceStore();
  const hasSumupReader = !!settings?.sumupReaderId;

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-open-tabs'],
    queryFn: () => deviceApi.getOpenOrders(),
    enabled: isOpen,
    refetchInterval: 10000,
  });

  const orders = ordersData?.data || [];

  const getRemainingAmount = (order: Order): number => {
    return Number(order.total) - Number(order.paidAmount || 0);
  };

  const totalRemaining = orders.reduce((sum, order) => sum + getRemainingAmount(order), 0);

  const payAllOrders = async (paymentMethod: PaymentMethod) => {
    setIsProcessing(true);
    try {
      for (const order of orders) {
        const remainingAmount = getRemainingAmount(order);
        if (remainingAmount <= 0) continue;

        await deviceApi.createPayment({
          orderId: order.id,
          amount: remainingAmount,
          paymentMethod,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
      setShowCashModal(false);
      setShowSumupModal(false);
      onClose();
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPayment = () => {
    setShowCashModal(true);
  };

  const handleCashConfirm = () => {
    payAllOrders('cash');
  };

  const handleCardPayment = () => {
    if (hasSumupReader) {
      setShowSumupModal(true);
    } else {
      payAllOrders('card');
    }
  };

  const handleSplit = () => {
    onSplitPayment();
    onClose();
  };

  return (
    <>
      <DialogModal
        isOpen={isOpen}
        onClose={onClose}
        title={t('title')}
        size="lg"
      >
        <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center p-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center p-6">
              <Receipt className="h-12 w-12 text-tertiary mb-4" />
              <p className="text-lg font-medium text-primary">{t('noOpenTabs')}</p>
              <p className="text-sm text-tertiary">{t('noOpenTabsDescription')}</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="px-6 pt-6 pb-3">
                <div className="rounded-lg bg-secondary p-3 flex items-center justify-between">
                  <p className="font-medium text-primary">
                    {orders.length} {t('orders', { count: orders.length })}
                  </p>
                  <div className="text-right">
                    <p className="text-sm text-tertiary">{t('totalOpen')}</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(totalRemaining)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable order list */}
              <div className="flex-1 overflow-auto px-6 pb-3">
                <div className="space-y-3">
                  {orders.map((order) => {
                    const remaining = getRemainingAmount(order);

                    return (
                      <div
                        key={order.id}
                        className="rounded-lg border border-secondary bg-primary p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">
                              #{order.dailyNumber || order.orderNumber}
                            </span>
                            {order.tableNumber && (
                              <span className="text-sm text-tertiary">
                                {t('table')} {order.tableNumber}
                              </span>
                            )}
                            {order.customerName && (
                              <span className="text-sm text-tertiary">- {order.customerName}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-brand-primary">
                              {formatCurrency(remaining)}
                            </p>
                            {Number(order.paidAmount) > 0 && (
                              <p className="text-xs text-tertiary">
                                {t('partlyPaid', { amount: formatCurrency(Number(order.paidAmount)) })}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Items inline */}
                        {order.items && order.items.length > 0 && (
                          <div className="space-y-0.5">
                            {order.items
                              .filter((item) => item.status !== 'cancelled')
                              .map((item, idx) => {
                                const isFullyPaid = (item.paidQuantity || 0) >= item.quantity;

                                return (
                                  <div
                                    key={idx}
                                    className={cx(
                                      'flex justify-between text-sm',
                                      isFullyPaid && 'line-through opacity-60'
                                    )}
                                  >
                                    <span className={cx(isFullyPaid ? 'text-error-primary' : 'text-tertiary')}>
                                      {item.quantity}x {item.productName}
                                    </span>
                                    <span className={cx(isFullyPaid ? 'text-error-primary' : 'text-primary')}>
                                      {formatCurrency(Number(item.totalPrice))}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sticky footer with payment actions */}
              <div className="border-t border-secondary px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-primary">{t('totalOpen')}</span>
                  <span className="text-2xl font-bold text-brand-primary">
                    {formatCurrency(totalRemaining)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    color="secondary"
                    size="lg"
                    onClick={handleCashPayment}
                    disabled={isProcessing}
                    iconLeading={BankNote01}
                  >
                    {t('payCash')}
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleCardPayment}
                    disabled={isProcessing}
                    iconLeading={CreditCard01}
                  >
                    {t('payCard')}
                  </Button>
                </div>

                <Button
                  color="tertiary"
                  size="lg"
                  className="w-full"
                  onClick={handleSplit}
                  iconLeading={Scissors01}
                >
                  {t('splitBill')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogModal>

      {/* Cash Payment Modal */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={totalRemaining}
        onConfirm={handleCashConfirm}
        isProcessing={isProcessing}
      />

      {/* SumUp Checkout Modal */}
      <SumUpCheckoutModal
        isOpen={showSumupModal}
        onClose={() => setShowSumupModal(false)}
        amount={totalRemaining}
        onSuccess={() => {
          setShowSumupModal(false);
          payAllOrders('sumup_terminal' as PaymentMethod);
        }}
      />
    </>
  );
}
