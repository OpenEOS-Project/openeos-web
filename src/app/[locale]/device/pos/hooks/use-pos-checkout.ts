'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { notifyCustomerDisplayOrderCompleted } from '@/hooks/use-customer-display-broadcast';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { deviceTablesApi } from '@/lib/device-tables-api';
import {
  cartItemsTotal,
  cartPfandOffset,
  cartPfandTotal,
  useCartStore,
  type CartContents,
} from '@/stores/cart-store';
import { ApiException } from '@/types/api';
import type { CreateOrderData, Order } from '@/types/order';
import type { PaymentsBatchData, PosTableContext } from '@/types/table';
import { uuidV4 } from '@/utils/uuid';
import type { DoneInfo } from '../components/done-sheet';
import type { PayResult } from '../components/pay-sheet';
import { usePosToast } from '../components/pos-toast';
import { billOf, contextId } from '../utils/tables';

/** Kennzeichnung einer To-go-Bestellung (F3: Notiz statt eigenem Abholtyp). */
export const TOGO_NOTE = 'To-go';

/** Laufende Anfrage (Senden/Kassieren): gleiche Inhalte → gleiche `clientRequestId`. */
const REQUEST_KEY = 'openeos-pos-request';

interface CheckoutContext {
  eventId: string | null;
  /**
   * Wirksamer Kassiermodus (Veranstaltung, sonst Organisation, sonst
   * `immediate`). Nur `tab` kennt „Senden“ (unbezahlte Bestellung, F8).
   */
  orderingMode: 'immediate' | 'tab';
  /** Wofür gebucht wird (an Theken-Geräten immer `counter`). */
  context: PosTableContext;
  chargePfand: boolean;
  /** Offene Bestellungen des Tisches (sonst leer). */
  sentOrders: Order[];
  /** „Tisch {label}“, „Theke“, „To-go“ — Kopf des Bons. */
  contextLabel: string;
  /** Tisch unbekannt/Pflicht (API): „Tisch wählen“ öffnen, Warenkorb mitnehmen. */
  onTableInvalid: () => void;
}

export interface CheckoutTotals {
  /** Zu zahlen: offene Bestellungen + Warenkorb − Rabatt. */
  due: number;
  /** Netto-Pfand der ungesendeten Positionen. */
  pfand: number;
  /** Angewandter Rabatt (gedeckelt wie die API rechnet). */
  discount: number;
  sentOpen: number;
  openOrderIds: string[];
}

/**
 * Summen fürs Kassieren (Spezifikation §5.2.3). Ohne gesendete Bestellungen
 * identisch mit `getPayableTotal()` des Warenkorbs; mit ihnen darf ein
 * Rabatt auch deren Positionen (ohne Pfand) mindern.
 */
export function checkoutTotals(cart: CartContents, chargePfand: boolean, sentOrders: Order[]): CheckoutTotals {
  const bill = billOf(sentOrders);
  const itemsTotal = cartItemsTotal(cart.items);
  const pfand = chargePfand
    ? Math.max(cartPfandTotal(cart.items) - cartPfandOffset(cart.items, cart.pfandReturns).convertedSum, 0)
    : 0;
  const requested = cart.appliedVouchers.reduce((sum, v) => sum + v.amount, 0);
  const discount = Math.min(requested, itemsTotal + bill.sentDiscountable);
  const due = Math.max(0, Math.round((bill.sentOpen + itemsTotal + pfand - discount) * 100) / 100);
  return { due, pfand, discount, sentOpen: bill.sentOpen, openOrderIds: bill.openOrderIds };
}

export function errorReason(error: unknown): string | null {
  if (!(error instanceof ApiException)) return null;
  return error.reason || error.code || null;
}

/**
 * `clientRequestId` je Inhalt: Solange Warenkorb und Kontext gleich sind,
 * bleibt die ID gleich — auch über ein Neuladen (sessionStorage). So legt
 * eine Wiederholung nach Netzfehler keine zweite Bestellung an.
 */
function requestIdFor(signature: string): string {
  try {
    const raw = window.sessionStorage.getItem(REQUEST_KEY);
    const stored = raw ? (JSON.parse(raw) as { signature: string; id: string }) : null;
    if (stored?.signature === signature) return stored.id;
    const id = uuidV4();
    window.sessionStorage.setItem(REQUEST_KEY, JSON.stringify({ signature, id }));
    return id;
  } catch {
    return uuidV4();
  }
}

function clearRequestId() {
  try {
    window.sessionStorage.removeItem(REQUEST_KEY);
  } catch {
    // Speicher gesperrt: nichts zu tun
  }
}

/**
 * Senden und Kassieren. Senden legt eine unbezahlte Bestellung an (nur
 * Modus `tab`). Kassieren legt ungesendete Positionen zusammen mit der
 * Zahlung an — Bestellung und Zahlung in einer Transaktion, offene
 * Bestellungen des Kontexts zahlen mit (`POST /device-api/orders` mit
 * `payment`); ohne ungesendete Positionen bucht es die offenen
 * Bestellungen als Sammelzahlung (`payments/batch`). So entsteht beim
 * Kassieren nie eine unbezahlte Bestellung, und Küche und Stationen
 * bekommen erst nach der Zahlung etwas. Karte: erst das Geld am
 * Lesegerät, dann die Bestellung.
 */
export function usePosCheckout({
  eventId,
  orderingMode,
  context,
  chargePfand,
  sentOrders,
  contextLabel,
  onTableInvalid,
}: CheckoutContext) {
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

  const createOrder = async (discount: number, payment?: CreateOrderData['payment']): Promise<Order> => {
    if (!eventId) throw new Error('No event selected');
    const cart = useCartStore.getState();
    const items = buildItems();
    const reason = cart.appliedVouchers.map((v) => v.name).join(', ');
    // Nur der Inhalt zählt (nicht, ob gesendet oder kassiert wird): eine
    // Wiederholung nach Fehler bekommt dieselbe Bestellung zurück.
    const signature = JSON.stringify({
      eventId,
      context: contextId(context),
      items,
      vouchers: cart.appliedVouchers.map((v) => [v.id, v.amount]),
    });
    const response = await deviceApi.createOrder({
      eventId,
      source: 'pos',
      clientRequestId: requestIdFor(signature),
      ...(context.kind === 'table'
        ? {
            fulfillmentType: 'table_service' as const,
            tableNumber: context.label,
            ...(context.tableId ? { tableId: context.tableId } : {}),
          }
        : {
            fulfillmentType: 'counter_pickup' as const,
            ...(context.kind === 'togo' ? { notes: TOGO_NOTE } : {}),
          }),
      items,
      ...(discount > 0 ? { discountAmount: discount, discountReason: reason } : {}),
      ...(payment ? { payment } : {}),
    });
    return response.data;
  };

  const invalidate = () => {
    for (const key of ['device-open-orders', 'device-table-status', 'device-order-history', 'device-orders']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    queryClient.invalidateQueries({ queryKey: ['device-products', eventId] });
  };

  /** Neue Positionen sind jetzt eine Bestellung auf dem Server. */
  const clearSent = () => {
    useCartStore.getState().clearCart();
    clearRequestId();
  };

  const handleTableError = (error: unknown) => {
    const reason = errorReason(error);
    if (reason === 'TABLE_NOT_FOUND' || reason === 'TABLE_REQUIRED') onTableInvalid();
  };

  /** „Senden“ (Modus `tab`): unbezahlte Bestellung an Küche und Theke. */
  const send = async () => {
    // „Sofort kassieren“: nie unbezahlt an die Küche (F8, die API lehnt es ab).
    if (orderingMode !== 'tab') return;
    const cart = useCartStore.getState();
    const count = cart.getItemCount();
    setIsSending(true);
    try {
      const order = await createOrder(cart.getDiscount());
      clearSent();
      invalidate();
      notifyCustomerDisplayOrderCompleted('tab', order.orderNumber || order.dailyNumber?.toString() || null);
      toast(t('cartV2.sent', { count }));
    } catch (error) {
      handleTableError(error);
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  /** Kassieren des Kontexts; liefert die Daten für das Abschluss-Blatt. */
  const pay = async (result: PayResult): Promise<DoneInfo> => {
    const cart = useCartStore.getState();
    const totals = checkoutTotals(cart, chargePfand, sentOrders);
    const hasOpen = totals.openOrderIds.length > 0;
    const sentLines = sentOrders.flatMap((order) =>
      (order.items ?? [])
        .filter((item) => item.status !== 'cancelled' && item.quantity - (item.paidQuantity || 0) > 0)
        .map((item) => {
          const open = item.quantity - (item.paidQuantity || 0);
          return {
            qty: `${open}x`,
            name: item.productName,
            total: formatPrice((Number(item.totalPrice) / Math.max(item.quantity, 1)) * open),
          };
        }),
    );
    const snapshot: DoneInfo = {
      orderIds: [],
      orderNumber: null,
      amount: totals.due,
      method: result.method,
      change: result.amountReceived !== undefined ? result.amountReceived - totals.due : 0,
      tip: result.tip,
      lines: [
        ...sentLines,
        ...cart.items.map((item) => ({
          qty: `${item.quantity}x`,
          name: item.product.name,
          total: formatPrice(item.unitPrice * item.quantity),
        })),
      ],
      pfand: totals.pfand,
      discount: totals.discount,
      time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };

    const charged = totals.due > 0 && result.method !== 'free';
    const reason = cart.appliedVouchers.map((v) => v.name).join(', ');
    const payment: Omit<PaymentsBatchData, 'orderIds'> = {
      paymentMethod: result.method === 'sumup' ? 'sumup_terminal' : result.method === 'card' ? 'card' : 'cash',
      ...(result.method === 'cash' && result.amountReceived !== undefined
        ? { amountReceived: result.amountReceived }
        : {}),
      ...(result.tip > 0 ? { tipAmount: result.tip } : {}),
      ...(result.method === 'sumup' && result.transactionId ? { providerTransactionId: result.transactionId } : {}),
      // Mit offenen Bestellungen läuft der Rabatt über die Zahlung (über alle verteilt).
      ...(hasOpen && totals.discount > 0
        ? { discountAmount: Math.round(totals.discount * 100) / 100, discountReason: reason }
        : {}),
    };

    const failed = (error: unknown) => {
      invalidate();
      // Karte: Das Geld ist gebucht — Warenkorb bleibt, „Erneut speichern“
      // wiederholt mit derselben Anfrage-ID.
      if (result.method === 'sumup') toast(t('pay.unsavedTitle'), 'danger');
      else
        toast(
          errorReason(error) === 'ORDER_ALREADY_PAID'
            ? t('tables.alreadyPaid')
            : apiErrorMessage(error, t('pay.orderFailed')),
          'danger',
        );
    };

    // 1. Ungesendete Positionen: Bestellung und Zahlung in einem Schritt —
    //    scheitert die Zahlung, gibt es auch keine Bestellung (kein
    //    Küchenbon). Offene Bestellungen des Kontexts zahlen mit.
    let created: Order | null = null;
    if (cart.items.length > 0) {
      const withPayment = hasOpen || charged;
      try {
        created = await createOrder(
          hasOpen ? 0 : totals.discount,
          withPayment ? { ...payment, ...(hasOpen ? { orderIds: totals.openOrderIds } : {}) } : undefined,
        );
        // Ältere API ohne Zahlung bei der Anlage: die Bestellung kam
        // unbezahlt an — dann wie früher hinterher kassieren.
        if (withPayment && created.paymentStatus !== 'paid') {
          await deviceTablesApi.payBatch({
            ...payment,
            orderIds: Array.from(new Set([...totals.openOrderIds, created.id])),
          });
        }
      } catch (error) {
        handleTableError(error);
        failed(error);
        throw error;
      }
    } else if (hasOpen) {
      // 2. Nur offene Bestellungen (Gastbestellung, Teilzahlungsrest, `tab`):
      //    eine Sammelzahlung über alle (atomar).
      try {
        await deviceTablesApi.payBatch({ ...payment, orderIds: totals.openOrderIds });
      } catch (error) {
        failed(error);
        throw error;
      }
    }

    const orderIds = Array.from(new Set([...totals.openOrderIds, ...(created ? [created.id] : [])]));

    clearSent();
    invalidate();
    const number = created ? created.orderNumber || String(created.dailyNumber) : null;
    notifyCustomerDisplayOrderCompleted('paid', number);
    const single = orderIds.length === 1;
    return {
      ...snapshot,
      orderIds,
      orderNumber: single ? (number ?? sentOrders.find((o) => o.id === orderIds[0])?.orderNumber ?? null) : null,
      heading: single ? null : t('tables.doneHeading', { context: contextLabel, count: orderIds.length }),
    };
  };

  return { send, pay, isSending };
}
