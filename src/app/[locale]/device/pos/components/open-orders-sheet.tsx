'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, EmptyState, Icon, Spinner } from '@openeos/ui';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceTablesApi } from '@/lib/device-tables-api';
import type { PaymentMethod } from '@/types/payment';
import type { PosCardMode } from '@/utils/pos-card-mode';
import { errorReason } from '../hooks/use-pos-checkout';
import { useOpenOrders } from '../hooks/use-open-orders';
import { remainingOf } from '../utils/tables';
import type { DoneInfo } from './done-sheet';
import { PaySheet, type PayResult } from './pay-sheet';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

interface OpenOrdersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  card: PosCardMode;
  disabled?: boolean;
  onSplit: () => void;
  onPaid: (info: DoneInfo) => void;
}

/**
 * Offene Bestellungen ohne Tisch (Theke/To-go, Modus „Offene Rechnungen“):
 * Auswahl einer oder mehrerer Bestellungen und gemeinsam in einer
 * Sammelzahlung kassieren, oder Rechnung teilen.
 */
export function OpenOrdersSheet({ isOpen, onClose, eventId, card, disabled, onSplit, onPaid }: OpenOrdersSheetProps) {
  const t = useTranslations('pos.openTabs');
  const tPay = useTranslations('pos.pay');
  const tTables = useTranslations('pos.tables');
  const formatPrice = useFormatPrice();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const { orders, isLoading } = useOpenOrders(eventId, { kind: 'counter' }, isOpen);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (isOpen) setExcluded(new Set());
  }, [isOpen]);

  const selected = orders.filter((o) => !excluded.has(o.id) && remainingOf(o) > 0);
  const total = selected.reduce((sum, o) => sum + remainingOf(o), 0);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invalidate = () => {
    for (const key of ['device-open-orders', 'device-table-status', 'device-order-history']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const pay = async (result: PayResult) => {
    const method: PaymentMethod =
      result.method === 'sumup' ? 'sumup_terminal' : result.method === 'card' ? 'card' : 'cash';
    const paidIds = selected.map((o) => o.id);
    try {
      // Alles oder nichts: eine Sammelzahlung statt einer Schleife je Bestellung.
      await deviceTablesApi.payBatch({
        orderIds: paidIds,
        paymentMethod: method,
        ...(method === 'cash' && result.amountReceived !== undefined ? { amountReceived: result.amountReceived } : {}),
        ...(result.tip > 0 ? { tipAmount: result.tip } : {}),
        ...(result.method === 'sumup' && result.transactionId ? { providerTransactionId: result.transactionId } : {}),
      });
    } catch (error) {
      toast(errorReason(error) === 'ORDER_ALREADY_PAID' ? tTables('alreadyPaidOrders') : apiErrorMessage(error), 'danger');
      invalidate();
      throw error;
    }
    invalidate();
    setPaying(false);
    onClose();
    onPaid({
      orderIds: paidIds,
      orderNumber: selected.length === 1 ? selected[0].orderNumber : null,
      amount: total,
      method: result.method,
      change: result.amountReceived ? result.amountReceived - total : 0,
      tip: result.tip,
      lines: selected.flatMap((order) =>
        (order.items ?? [])
          .filter((item) => item.status !== 'cancelled')
          .map((item) => ({
            qty: `${item.quantity}x`,
            name: item.productName,
            total: formatPrice(Number(item.totalPrice)),
          })),
      ),
      pfand: 0,
      discount: 0,
      time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <>
      <PosSheet
        open={isOpen}
        onClose={onClose}
        size="wide"
        icon="orders"
        title={t('title')}
        subtitle={orders.length > 0 ? `${orders.length} ${t('orders', { count: orders.length })}` : undefined}
        footer={
          orders.length > 0 ? (
            <>
              <Button variant="ghost" onClick={onSplit}>
                <Icon name="split" />
                {tPay('split')}
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="oe-grow"
                disabled={total <= 0 || disabled}
                onClick={() => setPaying(true)}
              >
                <Icon name="receipt" />
                {tPay('checkoutAmount', { amount: formatPrice(total) })}
              </Button>
            </>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="pos-center">
            <Spinner />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon={<Icon name="receipt" />} title={t('noOpenTabs')} description={t('noOpenTabsDescription')} />
        ) : (
          <ul className="pos-list">
            {orders.map((order) => {
              const items = (order.items ?? []).filter((item) => item.status !== 'cancelled');
              const checked = !excluded.has(order.id);
              return (
                <li key={order.id} className={checked ? 'pos-hist is-open' : 'pos-hist'}>
                  <label className="pos-hist__hd">
                    <Checkbox checked={checked} onChange={() => toggle(order.id)} />
                    <span className="pos-hist__main">
                      <span className="pos-hist__badges">
                        <b>#{order.dailyNumber || order.orderNumber}</b>
                        {order.tableNumber && (
                          <span>
                            {t('table')} {order.tableNumber}
                          </span>
                        )}
                        {order.customerName && <span>{order.customerName}</span>}
                      </span>
                      {Number(order.paidAmount) > 0 && (
                        <small>{t('partlyPaid', { amount: formatPrice(Number(order.paidAmount)) })}</small>
                      )}
                    </span>
                    <span className="pos-hist__sum">
                      <b>{formatPrice(remainingOf(order))}</b>
                    </span>
                  </label>
                  {items.length > 0 && (
                    <ul className="pos-hist__items">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className={(item.paidQuantity || 0) >= item.quantity ? 'is-cancelled' : undefined}
                        >
                          <span>
                            {item.quantity}x {item.productName}
                          </span>
                          <span>{formatPrice(Number(item.totalPrice))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PosSheet>

      <PaySheet
        open={paying}
        onClose={() => setPaying(false)}
        title={t('title')}
        subtitle={`${selected.length} ${t('orders', { count: selected.length })}`}
        amount={total}
        card={card}
        onPay={pay}
        disabled={disabled}
      />
    </>
  );
}
