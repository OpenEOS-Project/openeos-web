'use client';

import { useTranslations } from 'next-intl';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import {
  getOrderChannel,
  type Order,
  type OrderChannel,
  type OrderItem,
  type OrderPaymentStatus,
  type OrderStatus,
} from '@/types/order';

const statusBadge: Record<OrderStatus, string> = {
  open: 'badge badge--neutral',
  in_progress: 'badge badge--warning',
  ready: 'badge badge--info',
  completed: 'badge badge--success',
  cancelled: 'badge badge--error',
};

const paymentBadge: Record<OrderPaymentStatus, string> = {
  unpaid: 'badge badge--error',
  partly_paid: 'badge badge--warning',
  paid: 'badge badge--success',
  refunded: 'badge badge--neutral',
};

const channelBadge: Record<OrderChannel, string> = {
  service: 'badge badge--info',
  counter: 'badge badge--neutral',
  online: 'badge badge--success',
};

interface OrderDetailModalProps {
  order: Order | null;
  creatorLabel: string | null;
  onClose: () => void;
}

export function OrderDetailModal({ order, creatorLabel, onClose }: OrderDetailModalProps) {
  const t = useTranslations();

  if (!order) return null;

  const channel = getOrderChannel(order);
  const discount = Number(order.discountAmount || 0);
  const pfand = Number(order.pfandTotal || 0);
  const tip = Number(order.tipAmount || 0);

  return (
    <div className="modal__overlay" onClick={onClose}>
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2 style={{ margin: 0 }}>{t('orders.detail.title', { number: order.dailyNumber })}</h2>
            <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
              {order.orderNumber}
            </div>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className={channelBadge[channel]}>{t(`orders.channel.${channel}`)}</span>
            <span className={statusBadge[order.status]}>{t(`orders.status.${order.status}`)}</span>
            <span className={paymentBadge[order.paymentStatus]}>{t(`orders.paymentStatus.${order.paymentStatus}`)}</span>
          </div>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <MetaRow label={t('orders.detail.createdAt')} value={formatDateTime(order.createdAt)} />
            {creatorLabel && <MetaRow label={t('orders.detail.createdBy')} value={creatorLabel} />}
            {order.tableNumber && <MetaRow label={t('orders.columns.table')} value={order.tableNumber} />}
            {order.customerName && <MetaRow label={t('orders.customer')} value={order.customerName} />}
            {order.customerPhone && <MetaRow label={t('orders.detail.phone')} value={order.customerPhone} />}
          </div>

          {order.notes && (
            <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--ink) 4%, transparent)' }}>
              <span style={{ color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>{t('orders.detail.notes')}: </span>
              {order.notes}
            </div>
          )}

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(order.items ?? []).map((item) => (
              <ItemRow key={item.id} item={item} refillLabel={t('orders.detail.refill')} />
            ))}
          </div>

          {/* Totals */}
          <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <TotalRow label={t('orders.detail.subtotal')} value={formatCurrency(order.subtotal)} />
            {discount > 0 && (
              <TotalRow
                label={order.discountReason ? `${t('orders.detail.discount')} (${order.discountReason})` : t('orders.detail.discount')}
                value={`−${formatCurrency(discount)}`}
              />
            )}
            {pfand > 0 && <TotalRow label={t('orders.detail.pfand')} value={formatCurrency(pfand)} />}
            {tip > 0 && <TotalRow label={t('orders.detail.tip')} value={formatCurrency(tip)} />}
            <TotalRow label={t('orders.detail.total')} value={formatCurrency(order.total)} strong />
            {Number(order.paidAmount) > 0 && (
              <TotalRow label={t('orders.paid')} value={formatCurrency(order.paidAmount)} />
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function ItemRow({ item, refillLabel }: { item: OrderItem; refillLabel: string }) {
  const options = item.options?.selected ?? [];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {item.quantity}× {item.productName}
        </div>
        {options.length > 0 && (
          <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
            {options
              .map((o) => (o.excluded ? `− ${o.option}` : o.option))
              .join(', ')}
          </div>
        )}
        {item.isRefill && (
          <div style={{ fontSize: 12, color: 'var(--green-ink)' }}>{refillLabel}</div>
        )}
        {item.notes && (
          <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', fontStyle: 'italic' }}>
            {item.notes}
          </div>
        )}
      </div>
      <div className="mono" style={{ flexShrink: 0, fontWeight: 600 }}>
        {formatCurrency(item.totalPrice)}
      </div>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 16 : 13 }}>
      <span style={{ color: strong ? 'var(--ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)', fontWeight: strong ? 700 : 400 }}>
        {label}
      </span>
      <span className="mono" style={{ fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}
