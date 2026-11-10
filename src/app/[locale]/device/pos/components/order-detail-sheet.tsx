'use client';

import { useState } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import {
  DISPLAY_STATUS_ICON,
  DISPLAY_STATUS_TONE,
  ITEM_STATUS_TONE,
  cancellableQuantity,
  orderPlace,
  paymentIcon,
  paymentKey,
} from '@/utils/order-history';
import { Badge, Banner, Button, Icon, Spinner } from '@openeos/ui';
import { useMutation } from '@tanstack/react-query';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useFormatPrice } from '@/hooks/use-format-price';

import { deviceApi } from '@/lib/api-client';
import { deviceTablesApi } from '@/lib/device-tables-api';
import { canCompleteOrder } from '@/lib/operating-mode';

import type { OrderDetail, OrderDetailItem } from '@/types/order-history';
import type { PaymentMethod } from '@/types/payment';
import type { PosCardMode } from '@/utils/pos-card-mode';

import { useInvalidateOrders, useOrderDetail, useOrderTse, useRefundGate } from '../hooks/use-order-history';
import type { DoneInfo } from './done-sheet';
import { reportTse } from '../hooks/use-pos-tse';
import type { TseReceiptView } from '@/types/tse';
import { PosTseReceipts } from './pos-tse-receipts';
import { OrderCancelSheet } from './order-cancel-sheet';
import { OrderRefundSheet, type RefundPreset } from './order-refund-sheet';
import { type PayResult, PaySheet } from './pay-sheet';
import { PinPromptSheet } from './pin-prompt-sheet';
import { PosSheet } from './pos-sheet';
import { ReceiptHandoutSheet } from './receipt-handout-sheet';
import { usePosToast } from './pos-toast';

interface OrderDetailSheetProps {
  orderId: string | null;
  onClose: () => void;
  card: PosCardMode;
  disabled?: boolean;
  onPaid: (info: DoneInfo) => void;
  /** „Nur Bons“: keine Preise und Zahlungen, statt Kassieren „Abgeholt“ bzw. „Abschließen“. */
  orderOnly?: boolean;
  /** Bondrucker an dieser Kasse (für „Bon drucken“ im Beleg-Blatt). */
  canPrint?: boolean;
}

/**
 * Detail einer Bestellung: Positionen mit Status, Zahlungen, Erstattungen
 * und Verlauf. Aktionen je nach Zustand: Zahlung nachholen, Positionen
 * stornieren, erstatten (bezahlte Bestellungen nur mit Erstattung
 * stornieren), Nachdruck von Kassen- und Küchenbon.
 */
export function OrderDetailSheet({
  orderId,
  onClose,
  card,
  disabled,
  onPaid,
  orderOnly = false,
  canPrint = true,
}: OrderDetailSheetProps) {
  const t = useTranslations('pos.orderHistory');
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const toast = usePosToast();
  const apiErrorMessage = useApiErrorMessage();
  const invalidate = useInvalidateOrders();
  const gate = useRefundGate();
  const { data: order, isLoading } = useOrderDetail(orderId);
  // „Nur Bons“ hat keine Belege und keine TSE.
  const { data: tseViews } = useOrderTse(orderId, !orderOnly);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [refund, setRefund] = useState<RefundPreset | null>(null);
  const [paying, setPaying] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [handout, setHandout] = useState(false);

  /** „Nur Bons“: abschließen ohne Zahlung (abgeholt/serviert). */
  const complete = async () => {
    if (!order) return;
    setCompleting(true);
    try {
      await deviceTablesApi.completeOrders([order.id]);
      toast(t('completedToast'));
      invalidate();
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
    } finally {
      setCompleting(false);
    }
  };

  const reprint = useMutation({
    mutationFn: (type: 'tickets' | 'receipt') => deviceApi.reprintOrder(orderId!, type),
    onSuccess: () => {
      toast(t('reprintSuccess'));
      invalidate();
    },
    onError: (error) => toast(apiErrorMessage(error), 'danger'),
  });
  const reprintRefund = useMutation({
    mutationFn: (refundId: string) => deviceApi.reprintRefund(orderId!, refundId),
    onSuccess: (res) => {
      toast(
        res.data?.printed ? t('reprintSuccess') : t('noPrinter'),
        res.data?.printed ? undefined : 'danger'
      );
      invalidate();
    },
    onError: (error) => toast(apiErrorMessage(error), 'danger'),
  });

  const time = (value: string | null) =>
    value ? new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  const dateTime = (value: string) =>
    new Date(value).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const pay = async (result: PayResult) => {
    if (!order) return;
    const method: PaymentMethod =
      result.method === 'sumup' ? 'sumup_terminal' : result.method === 'card' ? 'card' : 'cash';
    let tse: TseReceiptView[] = [];
    try {
      const batch = await deviceTablesApi.payBatch({
        orderIds: [order.id],
        paymentMethod: method,
        ...(method === 'cash' && result.amountReceived !== undefined
          ? { amountReceived: result.amountReceived }
          : {}),
        ...(result.tip > 0 ? { tipAmount: result.tip } : {}),
        ...(result.method === 'sumup' && result.transactionId
          ? { providerTransactionId: result.transactionId }
          : {}),
      });
      tse = reportTse((batch.data?.payments ?? []).map((p) => p.tse));
    } catch (error) {
      toast(apiErrorMessage(error), 'danger');
      invalidate();
      throw error;
    }
    invalidate();
    setPaying(false);
    onPaid({
      orderIds: [order.id],
      orderNumber: order.orderNumber,
      amount: order.remaining,
      method: result.method,
      change: result.amountReceived ? result.amountReceived - order.remaining : 0,
      tip: result.tip,
      lines: order.items
        .filter((item) => item.status !== 'cancelled')
        .map((item) => ({
          qty: `${item.quantity}x`,
          name: item.productName,
          total: formatPrice(item.totalPrice),
        })),
      pfand: 0,
      discount: 0,
      time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      tse,
    });
  };

  const actionsAllowed = gate.permission !== 'disabled';
  const activeItems = order?.items.filter((i) => cancellableQuantity(i) > 0) ?? [];
  const isCancelled = order?.status === 'cancelled';
  const canPay = !orderOnly && !!order && !isCancelled && order.remaining > 0;
  const canRefund = !orderOnly && !!order && order.refundable > 0;
  // Unbezahlte Positionen stornieren; bezahlte nur über „Stornieren & erstatten“.
  const canCancelItems = !!order && !isCancelled && activeItems.length > 0 && order.refundable <= 0;
  const canCancelPaid = !orderOnly && !!order && !isCancelled && activeItems.length > 0 && order.refundable > 0;
  const canComplete =
    orderOnly && !!order && order.status !== 'completed' && !isCancelled && order.paymentStatus !== 'paid';
  const completeReady = !!order && canCompleteOrder(order);

  const footer = order ? (
    <div className="pos-oh-actions">
      {canComplete && (
        <Button
          variant="primary"
          size="lg"
          disabled={disabled || !completeReady}
          loading={completing}
          title={completeReady ? undefined : t('completeBlocked')}
          onClick={() => void complete()}
        >
          {!completing && <Icon name="check" />}
          {order.tableNumber ? t('complete') : t('pickedUp')}
        </Button>
      )}
      {canPay && (
        <Button variant="primary" size="lg" disabled={disabled} onClick={() => setPaying(true)}>
          <Icon name="receipt" />
          {t('payNow', { amount: formatPrice(order.remaining) })}
        </Button>
      )}
      {actionsAllowed && canCancelItems && (
        <Button
          variant="danger-quiet"
          size="lg"
          disabled={disabled}
          onClick={() => setCancelOpen(true)}
        >
          <Icon name="ban" />
          {t('cancelItems')}
        </Button>
      )}
      {actionsAllowed && canCancelPaid && (
        <Button
          variant="danger-quiet"
          size="lg"
          disabled={disabled}
          onClick={() => setRefund({ mode: 'items', cancelItems: true })}
        >
          <Icon name="ban" />
          {t('cancelAndRefund')}
        </Button>
      )}
      {actionsAllowed && canRefund && (
        <Button
          variant="secondary"
          size="lg"
          disabled={disabled}
          onClick={() => setRefund({ mode: 'items', cancelItems: false })}
        >
          <Icon name="undo" />
          {t('refund')}
        </Button>
      )}
      {order.payments.length > 0 && !orderOnly && (
        <Button variant="ghost" size="lg" onClick={() => setHandout(true)} data-testid="order-receipt">
          <Icon name="receipt" />
          {t('receipt')}
        </Button>
      )}
      <Button
        variant="ghost"
        size="lg"
        disabled={reprint.isPending}
        onClick={() => reprint.mutate('tickets')}
      >
        <Icon name="chef" />
        {t('reprintTickets')}
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <PosSheet
        open={!!orderId}
        onClose={onClose}
        size="wide"
        icon="receipt"
        title={order ? t('detailTitle', { number: order.dailyNumber }) : t('detailLoading')}
        subtitle={order ? `${order.orderNumber} · ${dateTime(order.createdAt)}` : undefined}
        footer={footer}
      >
        {isLoading || !order ? (
          <div className="pos-center">
            <Spinner />
          </div>
        ) : (
          <OrderDetailBody
            order={order}
            time={time}
            formatPrice={formatPrice}
            permissionNote={!actionsAllowed ? t('actionsDisabled') : null}
            orderOnly={orderOnly}
            onReprintRefund={(id) => reprintRefund.mutate(id)}
            reprintBusy={reprintRefund.isPending}
            tse={orderOnly ? [] : (tseViews ?? [])}
          />
        )}
      </PosSheet>

      <ReceiptHandoutSheet
        orderId={handout && order ? order.id : null}
        orderNumber={order?.orderNumber}
        canPrint={canPrint}
        onClose={() => {
          setHandout(false);
          invalidate();
        }}
      />

      {order && (
        <>
          <OrderCancelSheet
            open={cancelOpen}
            order={order}
            onClose={() => setCancelOpen(false)}
            run={gate.run}
            onDone={() => {
              setCancelOpen(false);
              invalidate();
            }}
            onRefundRequired={() => {
              setCancelOpen(false);
              setRefund({ mode: 'items', cancelItems: true });
            }}
          />
          {!orderOnly && (
          <OrderRefundSheet
            preset={refund}
            order={order}
            onClose={() => setRefund(null)}
            run={gate.run}
            onDone={() => invalidate()}
          />
          )}
          {!orderOnly && (
          <PaySheet
            open={paying}
            onClose={() => setPaying(false)}
            title={t('payTitle', { number: order.dailyNumber })}
            subtitle={order.tableNumber ? t('placeTable', { table: order.tableNumber }) : undefined}
            amount={order.remaining}
            card={card}
            onPay={pay}
            disabled={disabled}
          />
          )}
        </>
      )}
      <PinPromptSheet
        open={gate.pin.open}
        onClose={gate.pin.close}
        onSubmit={(pin) => void gate.pin.submit(pin)}
        busy={gate.pin.busy}
        error={gate.pin.error}
      />
    </>
  );
}

function OrderDetailBody({
  order,
  time,
  formatPrice,
  permissionNote,
  onReprintRefund,
  reprintBusy,
  orderOnly = false,
  tse,
}: {
  order: OrderDetail;
  time: (value: string | null) => string;
  formatPrice: (value: number) => string;
  permissionNote: string | null;
  onReprintRefund: (refundId: string) => void;
  reprintBusy: boolean;
  orderOnly?: boolean;
  /** TSE-Vorgänge der Bestellung (leer ohne Cloud-TSE). */
  tse: TseReceiptView[];
}) {
  const t = useTranslations('pos.orderHistory');
  const tTse = useTranslations('pos.tse');
  const place = orderPlace(order);
  // „Nur Bons“: keine Zahlungs- und Erstattungsschritte im Verlauf.
  const timeline = buildTimeline(order, formatPrice).filter(
    (entry) => !orderOnly || !PAYMENT_TIMELINE_TYPES.has(entry.type),
  );

  return (
    <div className="pos-oh-detail">
      <div className="pos-oh-head">
        <Badge tone={DISPLAY_STATUS_TONE[order.displayStatus]}>
          <Icon name={DISPLAY_STATUS_ICON[order.displayStatus]} />
          {t(`status.${order.displayStatus}`)}
        </Badge>
        <span>
          <Icon name={place === 'table' ? 'table' : place === 'togo' ? 'send' : 'utensils'} />
          {place === 'table'
            ? t('placeTable', { table: order.tableNumber ?? '' })
            : t(place === 'togo' ? 'placeTogo' : 'placeCounter')}
        </span>
        {order.deviceName && (
          <span>
            <Icon name="device" />
            {order.deviceName}
          </span>
        )}
        {order.createdByUserName && (
          <span>
            <Icon name="user" />
            {order.createdByUserName}
          </span>
        )}
        {order.customerName && (
          <span>
            <Icon name="user" />
            {order.customerName}
          </span>
        )}
      </div>

      {order.isTest && (
        <Banner tone="info" icon={<Icon name="info" />}>
          {t('testOrder')}
        </Banner>
      )}
      {permissionNote && (
        <Banner tone="warn" icon={<Icon name="lock" />}>
          {permissionNote}
        </Banner>
      )}
      {order.notes && (
        <p className="pos-oh-note">
          <Icon name="note" />
          {order.notes}
        </p>
      )}

      <section className="pos-oh-sec">
        <h3>{t('sectionItems')}</h3>
        <ul className="pos-oh-items">
          {order.items.map((item) => (
            <ItemLine key={item.id} item={item} formatPrice={formatPrice} showPrice={!orderOnly} />
          ))}
        </ul>
        {!orderOnly && (
        <dl className="pos-sums">
          <div>
            <dt>{t('subtotal')}</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discountAmount > 0 && (
            <div>
              <dt>
                {t('discount')}
                {order.discountReason ? ` (${order.discountReason})` : ''}
              </dt>
              <dd className="pos-oh-neg">{formatPrice(-order.discountAmount)}</dd>
            </div>
          )}
          {order.pfandTotal > 0 && (
            <div>
              <dt>{t('pfand')}</dt>
              <dd>{formatPrice(order.pfandTotal)}</dd>
            </div>
          )}
          {order.tipAmount > 0 && (
            <div>
              <dt>{t('tip')}</dt>
              <dd>{formatPrice(order.tipAmount)}</dd>
            </div>
          )}
          <div className="pos-oh-total">
            <dt>{t('total')}</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
          <div>
            <dt>{t('paid')}</dt>
            <dd>{formatPrice(order.paidAmount)}</dd>
          </div>
          {order.refundedAmount > 0 && (
            <div>
              <dt>{t('refunded')}</dt>
              <dd className="pos-oh-neg">{formatPrice(-order.refundedAmount)}</dd>
            </div>
          )}
          {order.remaining > 0 && order.status !== 'cancelled' && !order.closedWithoutPaymentAt && (
            <div className="pos-oh-due">
              <dt>{t('remaining')}</dt>
              <dd>{formatPrice(order.remaining)}</dd>
            </div>
          )}
          {/* Früher „Ohne Zahlung abschließen“ — nur noch als Historie. */}
          {order.closedWithoutPaymentAt && (
            <div>
              <dt>{t('closedWithoutPayment')}</dt>
              <dd />
            </div>
          )}
        </dl>
        )}
      </section>

      {order.payments.length > 0 && !orderOnly && (
        <section className="pos-oh-sec">
          <h3>{t('sectionPayments')}</h3>
          <ul className="pos-oh-lines">
            {order.payments.map((p) => (
              <li key={p.id}>
                <Icon name={paymentIcon(p.paymentMethod)} />
                <span className="pos-oh-lines__main">
                  <b>{t(`payment.${paymentKey(p.paymentMethod)}`)}</b>
                  <small>
                    {time(p.createdAt)}
                    {p.deviceName ? ` · ${p.deviceName}` : ''}
                    {p.userName ? ` · ${p.userName}` : ''}
                  </small>
                  {p.amountReceived !== null && (
                    <small>
                      {t('given', {
                        given: formatPrice(p.amountReceived),
                        change: formatPrice(p.change ?? 0),
                      })}
                    </small>
                  )}
                  {p.providerTransactionId && (
                    <small className="pos-oh-mono">
                      {t('transaction', { id: p.providerTransactionId })}
                    </small>
                  )}
                  {p.batchOrderCount && p.batchOrderCount > 1 && (
                    <small>{t('batchPayment', { count: p.batchOrderCount })}</small>
                  )}
                </span>
                <span className="pos-oh-lines__sum">
                  <b>{formatPrice(p.amount)}</b>
                  {p.refundedAmount > 0 && (
                    <small className="pos-oh-neg">{formatPrice(-p.refundedAmount)}</small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.refunds.length > 0 && !orderOnly && (
        <section className="pos-oh-sec">
          <h3>{t('sectionRefunds')}</h3>
          <ul className="pos-oh-lines">
            {order.refunds.map((r) => (
              <li key={r.id}>
                <Icon name="undo" />
                <span className="pos-oh-lines__main">
                  <b>
                    {t(r.kind === 'cancellation' ? 'refundKindCancellation' : 'refundKindRefund')}{' '}
                    <span className="pos-oh-mono">{r.refundNumber}</span>
                  </b>
                  <small>
                    {time(r.createdAt)} · {t(`payment.${paymentKey(r.paymentMethod)}`)}
                    {r.status !== 'completed' ? ` · ${t(`refundStatus.${r.status}`)}` : ''}
                    {r.deviceName ? ` · ${r.deviceName}` : ''}
                    {r.actorName ? ` · ${r.actorName}` : ''}
                  </small>
                  <small>
                    {t(`reasons.${r.reasonCode}`)}
                    {r.reasonText ? `: ${r.reasonText}` : ''}
                  </small>
                  {r.items.length > 0 && (
                    <small>
                      {r.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </small>
                  )}
                  {r.providerReference && (
                    <small className="pos-oh-mono">
                      {t('transaction', { id: r.providerReference })}
                    </small>
                  )}
                </span>
                <span className="pos-oh-lines__sum">
                  <b className="pos-oh-neg">{formatPrice(r.amount)}</b>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reprintBusy}
                    onClick={() => onReprintRefund(r.id)}
                  >
                    <Icon name="printer" />
                    {t('reprintRefund')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tse.length > 0 && (
        <section className="pos-oh-sec">
          {/* Zugeklappt: Signatur und Seriennummer sind lang; aufgeklappt
              zum Vorzeigen oder Abscannen (digitaler Beleg). */}
          <details className="pos-tse-details">
            <summary>
              <Icon name="shield" />
              {tTse('sectionTitle', { count: tse.length })}
            </summary>
            <PosTseReceipts views={tse} />
          </details>
        </section>
      )}

      <section className="pos-oh-sec">
        <h3>{t('sectionTimeline')}</h3>
        <ol className="pos-oh-timeline">
          {timeline.map((entry) => (
            <li key={entry.key} className={entry.tone ? `is-${entry.tone}` : undefined}>
              <span className="pos-oh-timeline__time">{time(entry.at)}</span>
              <span>
                <b>{t(`timeline.${entry.type}`, entry.values)}</b>
                {entry.who && <small>{entry.who}</small>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ItemLine({
  item,
  formatPrice,
  showPrice = true,
}: {
  item: OrderDetailItem;
  formatPrice: (value: number) => string;
  /** „Nur Bons“: ohne Betrag. */
  showPrice?: boolean;
}) {
  const t = useTranslations('pos.orderHistory');
  const options = item.options ?? [];
  const cancelled = item.status === 'cancelled';
  return (
    <li className={cancelled ? 'pos-oh-item is-cancelled' : 'pos-oh-item'}>
      <span className="pos-oh-item__qty">{item.quantity}x</span>
      <span className="pos-oh-item__main">
        <b>{item.productName}</b>
        {options.length > 0 && (
          <small>
            {options
              .map((o) => (o.excluded ? t('optionWithout', { option: o.option }) : o.option))
              .join(', ')}
          </small>
        )}
        {item.notes && <small className="pos-oh-item__note">{item.notes}</small>}
        {item.kitchenNotes && <small className="pos-oh-item__note">{item.kitchenNotes}</small>}
        {item.refundedQuantity > 0 && !cancelled && (
          <small className="pos-oh-neg">
            {t('itemRefunded', { count: item.refundedQuantity })}
          </small>
        )}
      </span>
      <Badge tone={ITEM_STATUS_TONE[item.status]}>{t(`itemStatus.${item.status}`)}</Badge>
      {showPrice && <span className="pos-oh-item__sum">{formatPrice(item.totalPrice)}</span>}
    </li>
  );
}

interface TimelineEntry {
  key: string;
  at: string;
  type: string;
  values?: Record<string, string | number>;
  who?: string | null;
  tone?: 'danger' | 'success';
}

/** Verlauf aus den Zeitstempeln und dem Protokoll der Bestellung. */
/** Verlaufseinträge mit Zahlungsbezug (in „Nur Bons“ ausgeblendet). */
const PAYMENT_TIMELINE_TYPES = new Set([
  'paid',
  'refunded',
  'refund_failed',
  'receipt_reprinted',
  'refund_receipt_reprinted',
  'receipt_link_created',
  'receipt_emailed',
  'receipt_email_failed',
]);

function buildTimeline(
  order: OrderDetail,
  formatPrice: (value: number) => string
): TimelineEntry[] {
  const out: TimelineEntry[] = [
    {
      key: 'created',
      at: order.createdAt,
      type: 'created',
      who: [order.deviceName, order.createdByUserName].filter(Boolean).join(' · ') || null,
    },
  ];
  for (const p of order.payments) {
    out.push({
      key: `pay-${p.id}`,
      at: p.createdAt,
      type: 'paid',
      values: { amount: formatPrice(p.amount) },
      who: [p.deviceName, p.userName].filter(Boolean).join(' · ') || null,
      tone: 'success',
    });
  }
  if (order.readyAt) out.push({ key: 'ready', at: order.readyAt, type: 'ready' });
  if (order.completedAt) out.push({ key: 'completed', at: order.completedAt, type: 'completed' });
  for (const e of order.events) {
    const who =
      [e.data?.deviceName as string | undefined, e.actorName].filter(Boolean).join(' · ') || null;
    const items = Array.isArray(e.data?.items)
      ? (e.data.items as { quantity: number; productName: string }[])
          .map((i) => `${i.quantity}x ${i.productName}`)
          .join(', ')
      : '';
    const refunds = Array.isArray(e.data?.refunds) ? (e.data.refunds as { amount: number }[]) : [];
    const amount =
      refunds.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0) ||
      Number(e.data?.amount) ||
      0;
    out.push({
      key: e.id,
      at: e.createdAt,
      // Beleg-Mail: Ergebnis steht in den Daten (ohne Adresse).
      type: e.type === 'receipt_emailed' && e.data?.status === 'failed' ? 'receipt_email_failed' : e.type,
      values: {
        items,
        amount: formatPrice(amount),
        from: e.fromWaiter?.shortName || e.fromWaiter?.name || '—',
        to: e.toWaiter?.shortName || e.toWaiter?.name || '—',
      },
      who,
      tone:
        e.type === 'refund_failed' ||
        e.type === 'items_cancelled' ||
        e.type === 'order_cancelled' ||
        (e.type === 'receipt_emailed' && e.data?.status === 'failed')
          ? 'danger'
          : undefined,
    });
  }
  if (order.cancelledAt && !order.events.some((e) => e.type === 'order_cancelled')) {
    out.push({ key: 'cancelled', at: order.cancelledAt, type: 'cancelled', tone: 'danger' });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
