'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, BankNote01, CreditCard01, Scissors01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import type { Order } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';

interface OpenTabsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSplitPayment: (order: Order) => void;
}

export function OpenTabsDrawer({ isOpen, onClose, onSplitPayment }: OpenTabsDrawerProps) {
  const t = useTranslations('pos.openTabs');
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['device-open-tabs'],
    queryFn: () => deviceApi.getOpenOrders(),
    enabled: isOpen,
    refetchInterval: 10000, // Refresh every 10 seconds when open
  });

  const orders = ordersData?.data || [];

  // Group orders by table number
  const ordersByTable = orders.reduce((acc, order) => {
    const key = order.tableNumber || t('noTable');
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const payFullOrder = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: PaymentMethod }) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');

      const remainingAmount = Number(order.total) - Number(order.paidAmount || 0);

      await deviceApi.createPayment({
        orderId,
        amount: remainingAmount,
        paymentMethod,
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      setSelectedOrder(null);
      setShowCashModal(false);
    },
  });

  const handlePayFull = async (paymentMethod: PaymentMethod) => {
    if (!selectedOrder) return;

    setIsProcessing(true);
    try {
      await payFullOrder.mutateAsync({
        orderId: selectedOrder.id,
        paymentMethod,
      });
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPayment = () => {
    if (!selectedOrder) return;
    setShowCashModal(true);
  };

  const handleCashConfirm = () => {
    handlePayFull('cash');
  };

  const handleSplit = () => {
    if (!selectedOrder) return;
    onSplitPayment(selectedOrder);
    onClose();
  };

  const getRemainingAmount = (order: Order) => {
    return Number(order.total) - Number(order.paidAmount || 0);
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
          ) : orders.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <Receipt className="h-12 w-12 text-tertiary mb-4" />
              <p className="text-lg font-medium text-primary">{t('noOpenTabs')}</p>
              <p className="text-sm text-tertiary">{t('noOpenTabsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Order List by Table */}
              {Object.entries(ordersByTable).map(([tableKey, tableOrders]) => (
                <div key={tableKey}>
                  <h3 className="text-sm font-medium text-tertiary mb-2">
                    {tableKey === t('noTable') ? tableKey : `${t('table')} ${tableKey}`}
                  </h3>
                  <div className="space-y-2">
                    {tableOrders.map((order) => {
                      const remaining = getRemainingAmount(order);
                      const isSelected = selectedOrder?.id === order.id;

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => setSelectedOrder(isSelected ? null : order)}
                          className={`w-full rounded-lg border p-4 text-left transition-colors ${
                            isSelected
                              ? 'border-brand-primary bg-brand-primary_alt'
                              : 'border-secondary bg-primary hover:bg-secondary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-primary">
                                #{order.dailyNumber || order.orderNumber}
                                {order.customerName && (
                                  <span className="ml-2 text-tertiary">- {order.customerName}</span>
                                )}
                              </p>
                              <p className="text-sm text-tertiary">
                                {order.items?.length || 0} {t('items')}
                              </p>
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

                          {/* Items Preview */}
                          {isSelected && order.items && order.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-secondary">
                              <div className="space-y-1">
                                {order.items.slice(0, 5).map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-tertiary">
                                      {item.quantity}x {item.productName}
                                    </span>
                                    <span className="text-primary">
                                      {formatCurrency(Number(item.totalPrice))}
                                    </span>
                                  </div>
                                ))}
                                {order.items.length > 5 && (
                                  <p className="text-xs text-tertiary">
                                    +{order.items.length - 5} {t('moreItems')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Payment Actions */}
              {selectedOrder && (
                <div className="border-t border-secondary pt-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-primary">{t('selectedOrder')}</span>
                    <span className="text-xl font-bold text-brand-primary">
                      {formatCurrency(getRemainingAmount(selectedOrder))}
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
                      onClick={() => handlePayFull('card')}
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
              )}
            </div>
          )}
        </div>
      </DialogModal>

      {/* Cash Payment Modal */}
      {selectedOrder && (
        <CashPaymentModal
          isOpen={showCashModal}
          onClose={() => setShowCashModal(false)}
          total={getRemainingAmount(selectedOrder)}
          onConfirm={handleCashConfirm}
          isProcessing={isProcessing}
        />
      )}
    </>
  );
}
