'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, Icon, Segment, Spinner, Stepper } from '@openeos/ui';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';
import { deviceApi } from '@/lib/api-client';
import { amountReceivedFor } from '@/utils/cash-tender';
import type { OrderItem } from '@/types/order';
import type { PaymentMethod } from '@/types/payment';
import type { PosCardMode } from '@/utils/pos-card-mode';
import { useOpenOrders, type OpenOrdersScope } from '../hooks/use-open-orders';
import { PaySheet, type PayResult } from './pay-sheet';
import { PosSheet } from './pos-sheet';
import { usePosToast } from './pos-toast';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string | null;
  /** Offene Bestellungen welches Kontexts: Tisch oder Theke. */
  scope: OpenOrdersScope | null;
  /** Karte: Lesegerät, Buchung ohne Gerät oder gar nicht. */
  card: PosCardMode;
  disabled?: boolean;
}

interface UnpaidItem {
  orderId: string;
  item: OrderItem;
  unpaid: number;
  unitPrice: number;
}

type GroupBy = 'order' | 'category';

/**
 * Rechnung teilen: Positionen offener Bestellungen auswählen und einzeln
 * kassieren (`/payments/split` je Bestellung). Nach jeder Teilzahlung
 * lädt die Liste neu; ist alles bezahlt, schließt das Blatt.
 */
export function SplitPaymentModal({ isOpen, onClose, eventId, scope, card, disabled }: SplitPaymentModalProps) {
  const t = useTranslations('pos.splitPayment');
  const tTabs = useTranslations('pos.openTabs');
  const tPay = useTranslations('pos.pay');
  const tCart = useTranslations('pos.cartV2');
  const formatPrice = useFormatPrice();
  const queryClient = useQueryClient();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();

  const [selection, setSelection] = useState<Record<string, number>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>('order');
  const [paying, setPaying] = useState(false);

  const { orders, isLoading } = useOpenOrders(eventId, scope, isOpen);

  const unpaidItems: UnpaidItem[] = useMemo(
    () =>
      orders.flatMap((order) =>
        (order.items ?? [])
          .filter((item) => item.status !== 'cancelled' && item.quantity - (item.paidQuantity || 0) > 0)
          .map((item) => ({
            orderId: order.id,
            item,
            unpaid: item.quantity - (item.paidQuantity || 0),
            unitPrice: Number(item.unitPrice) + Number(item.optionsPrice || 0),
          })),
      ),
    [orders],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: UnpaidItem[] }>();
    for (const entry of unpaidItems) {
      const order = orders.find((o) => o.id === entry.orderId);
      const key = groupBy === 'order' ? entry.orderId : entry.item.categoryName || t('uncategorized');
      const title =
        groupBy === 'order'
          ? `#${order?.dailyNumber || order?.orderNumber}${order?.tableNumber ? ` · ${t('table')} ${order.tableNumber}` : ''}`
          : key;
      if (!map.has(key)) map.set(key, { title, items: [] });
      map.get(key)!.items.push(entry);
    }
    return [...map.values()];
  }, [unpaidItems, orders, groupBy, t]);

  const selectedTotal = unpaidItems.reduce(
    (sum, entry) => sum + entry.unitPrice * (selection[entry.item.id] || 0),
    0,
  );
  const remaining = orders.reduce((sum, o) => sum + Number(o.total) - Number(o.paidAmount || 0), 0);

  const change = (entry: UnpaidItem, delta: number) =>
    setSelection((prev) => {
      const next = Math.max(0, Math.min(entry.unpaid, (prev[entry.item.id] || 0) + delta));
      const { [entry.item.id]: _removed, ...rest } = prev;
      void _removed;
      return next > 0 ? { ...rest, [entry.item.id]: next } : rest;
    });

  const selectAll = (entries: UnpaidItem[]) =>
    setSelection((prev) => ({
      ...prev,
      ...Object.fromEntries(entries.map((e) => [e.item.id, e.unpaid])),
    }));

  const invalidate = () =>
    Promise.all(
      ['device-open-orders', 'device-table-status', 'device-order-history'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );

  const pay = async (result: PayResult) => {
    const byOrder = new Map<string, { items: { orderItemId: string; quantity: number }[]; amount: number }>();
    for (const entry of unpaidItems) {
      const qty = selection[entry.item.id] || 0;
      if (qty <= 0) continue;
      const bucket = byOrder.get(entry.orderId) ?? { items: [], amount: 0 };
      bucket.items.push({ orderItemId: entry.item.id, quantity: qty });
      bucket.amount += entry.unitPrice * qty;
      byOrder.set(entry.orderId, bucket);
    }
    const payments = [...byOrder.entries()];
    const amounts = payments.map(([, p]) => p.amount);
    const method: PaymentMethod = result.method === 'sumup' ? 'sumup_terminal' : result.method === 'card' ? 'card' : 'cash';
    try {
      for (const [index, [orderId, p]] of payments.entries()) {
        const received = method === 'cash' ? amountReceivedFor(index, amounts, result.amountReceived) : undefined;
        await deviceApi.createSplitPayment({
          orderId,
          amount: p.amount,
          paymentMethod: method,
          items: p.items,
          ...(received !== undefined ? { amountReceived: received } : {}),
        });
      }
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
      invalidate();
      throw error;
    }
    const changeAmount = result.amountReceived ? result.amountReceived - selectedTotal : 0;
    toast(
      changeAmount > 0.0001
        ? tPay('splitPaidChange', { amount: formatPrice(selectedTotal), change: formatPrice(changeAmount) })
        : tPay('splitPaid', { amount: formatPrice(selectedTotal) }),
    );
    setSelection({});
    setPaying(false);
    await invalidate();
    if (remaining - selectedTotal <= 0.0001) onClose();
  };

  const hasItems = !isLoading && unpaidItems.length > 0;

  return (
    <>
      <PosSheet
        open={isOpen}
        onClose={onClose}
        size="wide"
        icon="split"
        title={t('title')}
        subtitle={
          hasItems
            ? `${orders.length} ${tTabs('orders', { count: orders.length })} · ${t('remaining')} ${formatPrice(remaining)}`
            : undefined
        }
        toolbar={
          hasItems ? (
            <>
              <Segment<GroupBy>
                size="lg"
                aria-label={t('selectItems')}
                value={groupBy}
                onChange={setGroupBy}
                options={[
                  { id: 'order', label: t('groupByOrder'), icon: 'receipt' },
                  { id: 'category', label: t('groupByCategory'), icon: 'grid' },
                ]}
              />
              <span className="pos-grow" />
              <Button variant="ghost" size="sm" disabled={selectedTotal <= 0} onClick={() => setSelection({})}>
                {t('clearSelection')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => selectAll(unpaidItems)}>
                {t('selectAll')}
              </Button>
            </>
          ) : undefined
        }
        footer={
          hasItems ? (
            <>
              <span className="pos-ft-sum">
                <small>{t('selectedAmount')}</small>
                <b>{formatPrice(selectedTotal)}</b>
              </span>
              <Button
                variant="primary"
                size="lg"
                className="oe-grow"
                disabled={selectedTotal <= 0 || disabled}
                onClick={() => setPaying(true)}
              >
                <Icon name="receipt" />
                {tPay('checkoutAmount', { amount: formatPrice(selectedTotal) })}
              </Button>
            </>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="pos-center">
            <Spinner />
          </div>
        ) : unpaidItems.length === 0 ? (
          <EmptyState icon={<Icon name="receipt" />} title={tTabs('noOpenTabs')} description={tTabs('noOpenTabsDescription')} />
        ) : (
          groups.map((group) => (
            <section key={group.title} className="pos-group">
              <div className="pos-group__hd">
                <span className="oe-label">{group.title}</span>
                <Button variant="ghost" size="sm" onClick={() => selectAll(group.items)}>
                  {t('selectAllCategory')}
                </Button>
              </div>
              <ul className="pos-list">
                {group.items.map((entry) => {
                  const qty = selection[entry.item.id] || 0;
                  return (
                    <li key={entry.item.id} className={qty > 0 ? 'pos-list__row is-selected' : 'pos-list__row'}>
                      <span className="pos-list__main">
                        <b>{entry.item.productName}</b>
                        <small>
                          {formatPrice(entry.unitPrice)} · {entry.unpaid} {t('open')}
                        </small>
                      </span>
                      <Stepper
                        value={qty}
                        max={entry.unpaid}
                        onDecrement={() => change(entry, -1)}
                        onIncrement={() => change(entry, 1)}
                        labels={{ decrease: tCart('qtyDecrease'), increase: tCart('qtyIncrease') }}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </PosSheet>

      <PaySheet
        open={paying}
        onClose={() => setPaying(false)}
        title={t('title')}
        amount={selectedTotal}
        card={card}
        onPay={pay}
        disabled={disabled}
      />
    </>
  );
}
