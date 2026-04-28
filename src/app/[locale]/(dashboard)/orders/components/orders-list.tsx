'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { ordersApi, eventsApi } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/utils/format';
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types/order';

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

export function OrdersList() {
  const t = useTranslations();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentStatus | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId,
  });

  const events = eventsData?.data || [];

  const queryParams: Record<string, string> = { limit: '100', includeItems: 'true' };
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (paymentFilter !== 'all') queryParams.paymentStatus = paymentFilter;
  if (eventFilter !== 'all') queryParams.eventId = eventFilter;

  const { data: ordersData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders', organizationId, statusFilter, paymentFilter, eventFilter],
    queryFn: () => ordersApi.list(organizationId!, queryParams as any),
    enabled: !!organizationId,
    refetchInterval: 10000,
  });

  const orders = ordersData?.data || [];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
        >
          <option value="all">{t('orders.filters.allStatuses')}</option>
          <option value="open">{t('orders.status.open')}</option>
          <option value="in_progress">{t('orders.status.inProgress')}</option>
          <option value="ready">{t('orders.status.ready')}</option>
          <option value="completed">{t('orders.status.completed')}</option>
          <option value="cancelled">{t('orders.status.cancelled')}</option>
        </select>

        <select
          className="select"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as OrderPaymentStatus | 'all')}
        >
          <option value="all">{t('orders.filters.allPayments')}</option>
          <option value="unpaid">{t('orders.paymentStatus.unpaid')}</option>
          <option value="partly_paid">{t('orders.paymentStatus.partlyPaid')}</option>
          <option value="paid">{t('orders.paymentStatus.paid')}</option>
          <option value="refunded">{t('orders.paymentStatus.refunded')}</option>
        </select>

        {events.length > 0 && (
          <select
            className="select"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="all">{t('orders.filters.allEvents')}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
          {t('orders.orderCount', { count: orders.length })}
        </span>

        <button
          className="btn btn--ghost"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? '...' : t('common.refresh')}
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('orders.noOrders')}</h3>
          <p className="empty-state__sub">{t('orders.noOrdersDescription')}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('orders.columns.orderNumber')}</th>
                <th>{t('orders.columns.table')}</th>
                <th>{t('orders.columns.items')}</th>
                <th>{t('orders.columns.status')}</th>
                <th>{t('orders.columns.payment')}</th>
                <th className="text-right">{t('orders.columns.total')}</th>
                <th>{t('orders.columns.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: Order) => {
                const statusCls = statusBadge[order.status] ?? 'badge badge--neutral';
                const paymentCls = paymentBadge[order.paymentStatus] ?? 'badge badge--neutral';

                return (
                  <tr key={order.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                            color: 'var(--green-ink)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'var(--f-mono)',
                            flexShrink: 0,
                          }}
                        >
                          #{order.dailyNumber}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>#{order.dailyNumber}</div>
                          <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)', fontFamily: 'var(--f-mono)' }}>{order.orderNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{order.tableNumber || '-'}</td>
                    <td>
                      {order.items && order.items.length > 0 ? (
                        <div>
                          {order.items.slice(0, 2).map((item) => (
                            <div key={item.id} style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                              {item.quantity}x {item.productName}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>
                              +{order.items.length - 2} {t('orders.moreItems')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'color-mix(in oklab, var(--ink) 35%, transparent)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={statusCls}>{t(`orders.status.${order.status}`)}</span>
                    </td>
                    <td>
                      <span className={paymentCls}>{t(`orders.paymentStatus.${order.paymentStatus}`)}</span>
                    </td>
                    <td className="mono text-right">
                      <div style={{ fontWeight: 600 }}>{formatCurrency(order.total)}</div>
                      {order.paidAmount > 0 && order.paidAmount < order.total && (
                        <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>
                          {t('orders.paid')}: {formatCurrency(order.paidAmount)}
                        </div>
                      )}
                    </td>
                    <td className="mono">{formatDate(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
