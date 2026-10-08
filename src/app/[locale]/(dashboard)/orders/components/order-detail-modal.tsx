'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@/components/shared/toast';
import { Icon } from '@openeos/ui';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { getOrderChannel, type Order, type OrderChannel, type OrderItemStatus } from '@/types/order';
import type { OrderDetail, OrderDisplayStatus } from '@/types/order-history';
import { paymentIcon, paymentKey } from '@/utils/order-history';

/** Ein Status je Bestellung, gleiche Bedeutung wie in der Kasse. */
export const displayStatusBadge: Record<OrderDisplayStatus, string> = {
  in_kitchen: 'badge badge--info',
  ready: 'badge badge--success',
  completed: 'badge badge--neutral',
  unpaid: 'badge badge--warning',
  cancelled: 'badge badge--error',
  partly_refunded: 'badge badge--warning',
  refunded: 'badge badge--neutral',
};

const itemBadge: Record<OrderItemStatus, string> = {
  pending: 'badge badge--neutral',
  preparing: 'badge badge--info',
  ready: 'badge badge--success',
  delivered: 'badge badge--neutral',
  cancelled: 'badge badge--error',
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
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  // Detail wie in der Kasse: Positionsstatus, Zahlungen, Erstattungen, Verlauf.
  const { data: detail } = useQuery({
    queryKey: ['order-history', organizationId, order?.id],
    queryFn: async () => (await ordersApi.history(organizationId!, order!.id)).data,
    enabled: !!organizationId && !!order,
  });
  const reprint = useMutation({
    mutationFn: (refundId: string) => ordersApi.reprintRefund(organizationId!, order!.id, refundId),
    onSuccess: (res) =>
      res.data?.printed ? toast.success(t('orders.history.reprinted')) : toast.error(t('orders.history.noPrinter')),
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

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
            {(() => {
              const display = detail?.displayStatus ?? order.displayStatus ?? 'in_kitchen';
              return <span className={displayStatusBadge[display]}>{t(`orders.displayStatus.${display}`)}</span>;
            })()}
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
            {(detail?.items ?? order.items ?? []).map((item) => (
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
            {Number(detail?.refundedAmount ?? 0) > 0 && (
              <>
                <TotalRow label={t('orders.history.refunded')} value={formatCurrency(-Number(detail!.refundedAmount))} />
                <TotalRow
                  label={t('orders.history.netTotal')}
                  value={formatCurrency(Number(order.paidAmount) - Number(detail!.refundedAmount))}
                />
              </>
            )}
          </div>

          {detail && <HistorySections detail={detail} onReprint={(id) => reprint.mutate(id)} reprinting={reprint.isPending} />}
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

type ItemLike = {
  id: string;
  quantity: number;
  productName: string;
  totalPrice: number;
  status: OrderItemStatus;
  isRefill: boolean;
  notes: string | null;
  refundedQuantity?: number;
  options: { selected?: { option: string; excluded?: boolean }[] } | { option: string; excluded?: boolean }[];
};

function ItemRow({ item, refillLabel }: { item: ItemLike; refillLabel: string }) {
  const t = useTranslations('orders.history');
  const { formatCurrency } = useLocaleFormat();
  const options = Array.isArray(item.options) ? item.options : (item.options?.selected ?? []);
  const cancelled = item.status === 'cancelled';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, opacity: cancelled ? 0.6 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ textDecoration: cancelled ? 'line-through' : undefined }}>
            {item.quantity}x {item.productName}
          </span>
          <span className={itemBadge[item.status]}>{t(`itemStatus.${item.status}`)}</span>
        </div>
        {Number(item.refundedQuantity ?? 0) > 0 && !cancelled && (
          <div style={{ fontSize: 12, color: 'var(--danger)' }}>
            {item.refundedQuantity}x {t('refunded')}
          </div>
        )}
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
      <div className="mono" style={{ flexShrink: 0, fontWeight: 600, textDecoration: cancelled ? 'line-through' : undefined }}>
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

function HistorySections({
  detail,
  onReprint,
  reprinting,
}: {
  detail: OrderDetail;
  onReprint: (refundId: string) => void;
  reprinting: boolean;
}) {
  const t = useTranslations('orders.history');
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const muted = 'color-mix(in oklab, var(--ink) 50%, transparent)';
  const box = { border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 8, padding: '10px 12px' };
  const events = [
    ...detail.events.map((e) => ({ at: e.createdAt, type: e.type, who: [e.data?.deviceName as string | undefined, e.actorName].filter(Boolean).join(' · ') })),
    ...(detail.cancelledAt && !detail.events.some((e) => e.type === 'order_cancelled')
      ? [{ at: detail.cancelledAt, type: 'cancelled', who: '' }]
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <>
      {detail.payments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('payments')}
          </div>
          {detail.payments.map((p) => (
            <div key={p.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name={paymentIcon(p.paymentMethod)} size={16} />
                {t(`payment.${paymentKey(p.paymentMethod)}`)} · {formatDateTime(p.createdAt)}
                {p.deviceName ? ` · ${p.deviceName}` : ''}
              </span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {formatCurrency(p.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {detail.refunds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('refunds')}
          </div>
          {detail.refunds.map((r) => (
            <div key={r.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>
                  {t(`kind.${r.kind}`)} <span className="mono">{r.refundNumber}</span>
                </span>
                <span style={{ color: muted }}>
                  {formatDateTime(r.createdAt)} · {t(`payment.${paymentKey(r.paymentMethod)}`)} · {t(`refundStatus.${r.status}`)}
                  {r.actorName ? ` · ${r.actorName}` : ''}
                  {r.deviceName ? ` · ${r.deviceName}` : ''}
                </span>
                <span style={{ color: muted }}>
                  {t('reason')}: {t(`reasons.${r.reasonCode}`)}
                  {r.reasonText ? ` (${r.reasonText})` : ''}
                </span>
                {r.items.length > 0 && (
                  <span style={{ color: muted }}>{r.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--danger)' }}>
                  {formatCurrency(r.amount)}
                </span>
                <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} disabled={reprinting} onClick={() => onReprint(r.id)}>
                  <Icon name="printer" size={14} /> {t('reprint')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('timeline')}
          </div>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <span className="mono" style={{ color: muted, flexShrink: 0 }}>
                {formatDateTime(e.at)}
              </span>
              <span>
                {t(`timelineEvents.${e.type}`, { items: '', amount: '' }).replace(/:\s*$/, '')}
                {e.who ? <span style={{ color: muted }}> · {e.who}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
