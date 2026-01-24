'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash01, Plus, Minus, CreditCard01, BankNote01, X, Receipt, File01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { useCartStore, useCartHydration } from '@/stores/cart-store';
import { deviceApi } from '@/lib/api-client';
import { formatCurrency } from '@/utils/format';
import { CashPaymentModal } from './cash-payment-modal';
import type { PaymentMethod } from '@/types/payment';

interface PosCartProps {
  organizationId: string;
  tableNumber?: string;
  orderingMode?: 'immediate' | 'tab';
  onClose?: () => void;
  onOpenTabs?: () => void;
}

export function PosCart({ organizationId, tableNumber: sessionTableNumber, orderingMode = 'immediate', onClose, onOpenTabs }: PosCartProps) {
  const t = useTranslations('pos');
  const queryClient = useQueryClient();
  const cartHydrated = useCartHydration();
  const {
    items,
    eventId,
    tableNumber: cartTableNumber,
    setTableNumber,
    updateItemQuantity,
    removeItem,
    clearCart,
    getTotal,
  } = useCartStore();

  // Use session table number if provided, otherwise use cart table number
  const tableNumber = sessionTableNumber || cartTableNumber;

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);

  const total = getTotal();

  // Mutation for immediate payment mode (create order + payment)
  const createOrderWithPayment = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      if (!eventId) throw new Error('No event selected');

      // Create order via device API
      const orderResponse = await deviceApi.createOrder({
        eventId,
        tableNumber: tableNumber || undefined,
        source: 'pos',
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
        })),
      });

      const order = orderResponse.data;

      // Create payment via device API
      await deviceApi.createPayment({
        orderId: order.id,
        amount: total,
        paymentMethod,
      });

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      clearCart();

      // Clear success message after 5 seconds
      setTimeout(() => setLastOrderNumber(null), 5000);
    },
  });

  // Mutation for tab mode (create order without payment)
  const createOrderOnly = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event selected');

      // Create order via device API (no payment)
      const orderResponse = await deviceApi.createOrder({
        eventId,
        tableNumber: tableNumber || undefined,
        source: 'pos',
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
        })),
      });

      return orderResponse.data;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['device-orders'] });
      queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
      setLastOrderNumber(order.orderNumber || order.dailyNumber?.toString());
      clearCart();

      // Clear success message after 5 seconds
      setTimeout(() => setLastOrderNumber(null), 5000);
    },
  });

  const handleCheckout = async (paymentMethod: PaymentMethod) => {
    if (items.length === 0) return;

    setIsProcessing(true);
    try {
      await createOrderWithPayment.mutateAsync(paymentMethod);
      setShowCashModal(false);
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTabOrder = async () => {
    if (items.length === 0) return;

    setIsProcessing(true);
    try {
      await createOrderOnly.mutateAsync();
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPaymentClick = () => {
    if (items.length === 0) return;
    setShowCashModal(true);
  };

  const handleCashPaymentConfirm = () => {
    handleCheckout('cash');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Cart Header */}
      <div className="border-b border-secondary p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">{t('cart.title')}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Success Message */}
      {lastOrderNumber && (
        <div className="border-b border-success-primary bg-success-secondary p-4">
          <p className="text-center font-semibold text-success-primary">
            {t('cart.orderCreated', { number: lastOrderNumber })}
          </p>
        </div>
      )}

      {/* Order Details */}
      {!sessionTableNumber && (
        <div className="border-b border-secondary p-4">
          <div className="space-y-1.5">
            <Label htmlFor="tableNumber" className="text-xs">
              {t('cart.tableNumber')}
            </Label>
            <Input
              id="tableNumber"
              value={cartTableNumber}
              onChange={(value) => setTableNumber(value)}
              placeholder={t('cart.tableNumberPlaceholder')}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-4">
        {!cartHydrated ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-tertiary">{t('cart.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-secondary bg-secondary p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary truncate">{item.product.name}</p>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-tertiary">
                      {item.selectedOptions.map((o) => o.option).join(', ')}
                    </p>
                  )}
                  <p className="text-sm text-brand-primary font-medium mt-1">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary hover:bg-secondary"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-primary">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-secondary bg-primary text-tertiary hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-error-primary hover:bg-error-secondary"
                  >
                    <Trash01 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-secondary p-4 space-y-4">
        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-primary">{t('cart.total')}</span>
          <span className="text-2xl font-bold text-brand-primary">{formatCurrency(total)}</span>
        </div>

        {/* Actions - Different based on ordering mode */}
        {orderingMode === 'immediate' ? (
          <>
            {/* Immediate Payment Mode */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                color="secondary"
                size="lg"
                className="flex-1"
                disabled={items.length === 0 || isProcessing}
                onClick={handleCashPaymentClick}
                iconLeading={BankNote01}
              >
                {t('cart.payCash')}
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={items.length === 0 || isProcessing}
                onClick={() => handleCheckout('card')}
                iconLeading={CreditCard01}
              >
                {t('cart.payCard')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Tab Mode */}
            <Button
              size="lg"
              className="w-full"
              disabled={items.length === 0 || isProcessing}
              onClick={handleTabOrder}
              iconLeading={Receipt}
            >
              {t('cart.placeOrder')}
            </Button>
            <Button
              color="secondary"
              size="lg"
              className="w-full"
              onClick={onOpenTabs}
              iconLeading={File01}
            >
              {t('cart.openTabs')}
            </Button>
          </>
        )}

        {items.length > 0 && (
          <Button
            color="tertiary"
            size="sm"
            className="w-full"
            onClick={clearCart}
            disabled={isProcessing}
          >
            {t('cart.clear')}
          </Button>
        )}
      </div>

      {/* Cash Payment Modal */}
      <CashPaymentModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        total={total}
        onConfirm={handleCashPaymentConfirm}
        isProcessing={isProcessing}
      />
    </div>
  );
}
