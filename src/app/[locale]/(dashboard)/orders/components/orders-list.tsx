'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { ordersApi, eventsApi } from '@/lib/api-client';
import { formatDateTime, formatCurrency } from '@/utils/format';
import {
  getOrderChannel,
  type Order,
  type OrderChannel,
  type OrderStatus,
  type OrderPaymentStatus,
} from '@/types/order';
import { OrderDetailModal } from './order-detail-modal';

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

// Maps the combined channel filter to the API's source/fulfillmentType params.
const channelQuery: Record<OrderChannel, Record<string, string>> = {
  service: { source: 'pos', fulfillmentType: 'table_service' },
  counter: { source: 'pos', fulfillmentType: 'counter_pickup' },
  online: { source: 'online' },
};

const PAGE_LIMIT = 50;

export function OrdersList() {
  const t = useTranslations();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Every filter change invalidates the current page — always jump back to page 1.
  const updateFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId,
  });

  const events = eventsData?.data || [];

  const filterParams: Record<string, string> = {};
  if (statusFilter !== 'all') filterParams.status = statusFilter;
  if (paymentFilter !== 'all') filterParams.paymentStatus = paymentFilter;
  if (eventFilter !== 'all') filterParams.eventId = eventFilter;
  if (channelFilter !== 'all') Object.assign(filterParams, channelQuery[channelFilter]);

  const listParams: Record<string, string> = {
    ...filterParams,
    page: String(page),
    limit: String(PAGE_LIMIT),
    includeItems: 'true',
  };

  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    isFetching: isFetchingOrders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter, page],
    queryFn: () => ordersApi.list(organizationId!, listParams as never),
    enabled: !!organizationId,
    refetchInterval: 10000,
  });

  const orders = ordersData?.data || [];
  const meta = ordersData?.meta;

  // Aggregates over ALL orders matching the filters (not just the current page).
  const {
    data: statsData,
    isLoading: isLoadingStats,
    isFetching: isFetchingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['orders-stats', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter],
    queryFn: () => ordersApi.stats(organizationId!, filterParams as never),
    enabled: !!organizationId,
    refetchInterval: 10000,
  });

  const stats = statsData?.data;
  const summary = {
    count: stats?.count ?? 0,
    revenue: stats?.revenue ?? 0,
    pfand: stats?.pfand ?? 0,
    average: stats?.avgReceipt ?? 0,
  };

  const isLoading = isLoadingOrders || isLoadingStats;
  const isFetching = isFetchingOrders || isFetchingStats;
  const refetch = () => {
    refetchOrders();
    refetchStats();
  };

  // If a refetch shrinks the result set (e.g. a filter narrows it), clamp back
  // onto the last valid page instead of showing an empty page forever.
  useEffect(() => {
    if (meta && meta.totalPages >= 1 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  const creatorLabel = (order: Order): string | null => {
    if (order.createdByUser) {
      return `${order.createdByUser.firstName} ${order.createdByUser.lastName}`.trim();
    }
    if (order.createdByDevice?.name) return order.createdByDevice.name;
    return null;
  };

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
      {/* Summary tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
        }}
      >
        <SummaryTile label={t('orders.summary.orders')} value={String(summary.count)} />
        <SummaryTile label={t('orders.summary.revenue')} value={formatCurrency(summary.revenue)} accent />
        <SummaryTile label={t('orders.summary.average')} value={formatCurrency(summary.average)} />
        <SummaryTile label={t('orders.summary.pfand')} value={formatCurrency(summary.pfand)} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '16px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
        <select
          className="select"
          style={{ flex: '1 1 140px', minWidth: 0 }}
          value={statusFilter}
          onChange={(e) => updateFilter(setStatusFilter)(e.target.value as OrderStatus | 'all')}
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
          style={{ flex: '1 1 140px', minWidth: 0 }}
          value={paymentFilter}
          onChange={(e) => updateFilter(setPaymentFilter)(e.target.value as OrderPaymentStatus | 'all')}
        >
          <option value="all">{t('orders.filters.allPayments')}</option>
          <option value="unpaid">{t('orders.paymentStatus.unpaid')}</option>
          <option value="partly_paid">{t('orders.paymentStatus.partlyPaid')}</option>
          <option value="paid">{t('orders.paymentStatus.paid')}</option>
          <option value="refunded">{t('orders.paymentStatus.refunded')}</option>
        </select>

        <select
          className="select"
          style={{ flex: '1 1 140px', minWidth: 0 }}
          value={channelFilter}
          onChange={(e) => updateFilter(setChannelFilter)(e.target.value as OrderChannel | 'all')}
        >
          <option value="all">{t('orders.filters.allChannels')}</option>
          <option value="service">{t('orders.channel.service')}</option>
          <option value="counter">{t('orders.channel.counter')}</option>
          <option value="online">{t('orders.channel.online')}</option>
        </select>

        {events.length > 0 && (
          <select
            className="select"
            style={{ flex: '1 1 140px', minWidth: 0 }}
            value={eventFilter}
            onChange={(e) => updateFilter(setEventFilter)(e.target.value)}
          >
            <option value="all">{t('orders.filters.allEvents')}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        )}

        <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t('orders.orderCount', { count: summary.count })}
        </span>

        <button
          className="btn btn--ghost"
          style={{ padding: 8, minWidth: 0, flexShrink: 0 }}
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label={t('common.refresh')}
          title={t('common.refresh')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={isFetching ? { animation: 'spin 0.75s linear infinite' } : undefined}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 4 21 10 15 10" />
          </svg>
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
                <th>{t('orders.columns.channel')}</th>
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
                const channel = getOrderChannel(order);
                const creator = creatorLabel(order);

                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    style={{ cursor: 'pointer' }}
                  >
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
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {order.tableNumber
                              ? t('orders.tableLabel', { table: order.tableNumber })
                              : order.customerName || `#${order.dailyNumber}`}
                          </div>
                          <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)', fontFamily: 'var(--f-mono)' }}>{order.orderNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={channelBadge[channel]}>{t(`orders.channel.${channel}`)}</span>
                      {creator && (
                        <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)', marginTop: 4 }}>
                          {creator}
                        </div>
                      )}
                    </td>
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
                    <td className="mono">{formatDateTime(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && orders.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '12px 20px' }}>
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
            {t('orders.orderCount', { count: meta.total })}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 13 }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
            >
              {t('orders.pagination.prev')}
            </button>
            <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', padding: '0 8px' }}>
              {t('orders.pagination.pageOf', { page: meta.page, totalPages: meta.totalPages })}
            </span>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 13 }}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
            >
              {t('orders.pagination.next')}
            </button>
          </div>
        </div>
      )}

      <OrderDetailModal
        order={selectedOrder}
        creatorLabel={selectedOrder ? creatorLabel(selectedOrder) : null}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: accent
          ? 'color-mix(in oklab, var(--green-soft) 50%, var(--paper))'
          : 'color-mix(in oklab, var(--ink) 3%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--ink) 7%, transparent)',
      }}
    >
      <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'var(--f-mono)',
          color: accent ? 'var(--green-ink)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
