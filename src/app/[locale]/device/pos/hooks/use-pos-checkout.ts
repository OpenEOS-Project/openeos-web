'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { notifyCustomerDisplayOrderCompleted } from '@/hooks/use-customer-display-broadcast';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { useCartStore } from '@/stores/cart-store';
import type { Order } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';
import type { DoneInfo } from '../components/done-sheet';
import type { PayResult } from '../components/pay-sheet';
import { usePosToast } from '../components/pos-toast';

interface CheckoutContext {
  eventId: string | null;
  tableNumber: string | null;
  fulfillmentType: 'table_service' | 'counter_pickup';
  chargePfand: boolean;
}

const PAYMENT_METHOD: Record<PayResult['method'], PaymentMethod> = {
  cash: 'cash',
  card: 'card',
  sumup: 'sumup_terminal',
  free: 'cash',
};

/**
 * Senden und Kassieren des Warenkorbs — Ablauf wie bisher:
 * Order anlegen (mit Rabatt), dann Zahlung buchen; bei Karte erst das
 * Geld am Lesegerät, dann die Order. Die Summen kommen unverändert aus
 * dem Warenkorb-Speicher.
 */
export function usePosCheckout({ eventId, tableNumber, fulfillmentType, chargePfand }: CheckoutContext) {
  const t = useTranslations('pos');
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const queryClient = useQueryClient();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const [isSending, setIsSending] = useState(false);

  /** Positionen für die API; mit Pfand verrechnete Einheiten gehen als Nachfüllen. */
  const buildItems = () => {
    const cart = useCartStore.getState();
    const offsetByItem = chargePfand ? cart.getPfandOffset().byItem : {};
    return cart.items.flatMap((item) => {
      const base = {
        productId: item.product.id,
        ...(item.notes ? { notes: item.notes } : {}),
        ...(item.kitchenNotes ? { kitchenNotes: item.kitchenNotes } : {}),
        ...(item.selectedOptions.length > 0 ? { selectedOptions: item.selectedOptions } : {}),
      };
      if (!chargePfand || !item.pfandType) return [{ ...base, quantity: item.quantity }];
      const refillUnits = Math.min(item.refillCount + (offsetByItem[item.id] || 0), item.quantity);
      const depositUnits = item.quantity - refillUnits;
      const lines: Array<typeof base & { quantity: number; isRefill?: boolean }> = [];
      if (depositUnits > 0) lines.push({ ...base, quantity: depositUnits });
      if (refillUnits > 0) lines.push({ ...base, quantity: refillUnits, isRefill: true });
      return lines;
    });
  };

  const createOrder = async (tip = 0): Promise<Order> => {
    if (!eventId) throw new Error('No event selected');
    const cart = useCartStore.getState();
    const discount = cart.getDiscount();
    const response = await deviceApi.createOrder({
      eventId,
      tableNumber: tableNumber || undefined,
      source: 'pos',
      fulfillmentType,
      items: buildItems(),
      ...(discount > 0
        ? { discountAmount: discount, discountReason: cart.appliedVouchers.map((v) => v.name).join(', ') }
        : {}),
      ...(tip > 0 ? { tipAmount: tip } : {}),
    });
    return response.data;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['device-orders'] });
    queryClient.invalidateQueries({ queryKey: ['device-open-tabs'] });
    queryClient.invalidateQueries({ queryKey: ['device-order-history'] });
    queryClient.invalidateQueries({ queryKey: ['device-products', eventId] });
  };

  /** „Senden“ (Modus `tab`): unbezahlte Order an Küche und Theke. */
  const send = async () => {
    const count = useCartStore.getState().getItemCount();
    setIsSending(true);
    try {
      const order = await createOrder();
      invalidate();
      notifyCustomerDisplayOrderCompleted('tab', order.orderNumber || order.dailyNumber?.toString() || null);
      useCartStore.getState().clearCart();
      toast(t('cartV2.sent', { count }));
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  /** Kassieren des Warenkorbs; liefert die Daten für das Abschluss-Blatt. */
  const pay = async (result: PayResult): Promise<DoneInfo> => {
    const cart = useCartStore.getState();
    const payable = chargePfand ? cart.getPayableTotal() : cart.getNetTotal();
    const snapshot: DoneInfo = {
      orderIds: [],
      orderNumber: null,
      amount: payable,
      method: result.method,
      change: result.amountReceived !== undefined ? result.amountReceived - payable : 0,
      tip: result.tip,
      lines: cart.items.map((item) => ({
        qty: `${item.quantity}x`,
        name: item.product.name,
        total: formatPrice(item.unitPrice * item.quantity),
      })),
      pfand: chargePfand ? cart.getNetPfandTotal() : 0,
      discount: cart.getDiscount(),
      time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };

    let order: Order;
    try {
      order = await createOrder(result.tip);
    } catch (error) {
      toast(
        result.method === 'sumup' ? t('pay.unsavedTitle') : apiErrorMessage(error, t('pay.orderFailed')),
        'danger',
      );
      throw error;
    }

    const charged = payable + result.tip;
    if (charged > 0 && result.method !== 'free') {
      try {
        await deviceApi.createPayment({
          orderId: order.id,
          amount: charged,
          paymentMethod: PAYMENT_METHOD[result.method],
          ...(result.method === 'cash' && result.amountReceived !== undefined
            ? { amountReceived: result.amountReceived }
            : {}),
          ...(result.method === 'sumup' && result.transactionId
            ? { providerTransactionId: result.transactionId }
            : {}),
        });
      } catch (error) {
        // Order steht, Zahlung nicht: Warenkorb leeren, Hinweis auf
        // „Offene Bestellungen“ — sonst würde doppelt bestellt.
        invalidate();
        useCartStore.getState().clearCart();
        toast(`${t('pay.paymentFailed')} ${apiErrorMessage(error)}`, 'danger');
        throw error;
      }
    }

    invalidate();
    notifyCustomerDisplayOrderCompleted('paid', order.orderNumber || order.dailyNumber?.toString() || null);
    useCartStore.getState().clearCart();
    return { ...snapshot, orderIds: [order.id], orderNumber: order.orderNumber || String(order.dailyNumber) };
  };

  return { send, pay, isSending };
}
