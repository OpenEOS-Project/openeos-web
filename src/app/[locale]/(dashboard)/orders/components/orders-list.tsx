'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';
import { ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { ordersApi, eventsApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { getOrderChannel, type Order, type OrderChannel } from '@/types/order';
import type { HistoryPaymentFilter } from '@/types/order-history';
import { STATUS_FILTERS, paymentIcon } from '@/utils/order-history';
import { OrderDetailModal, displayStatusBadge } from './order-detail-modal';

const PAYMENT_FILTERS: HistoryPaymentFilter[] = ['cash', 'card', 'sumup', 'discount'];

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
  const { formatDateTime, formatCurrency } = useLocaleFormat();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  // Ein Status wie in der Kasse (In Küche, Fertig, Offen, Abgeschlossen, Storniert, Erstattet).
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<HistoryPaymentFilter | 'all'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Every filter change invalidates the current page — always jump back to page 1.
  const updateFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  // Suche erst nach einer kurzen Pause an den Server.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId,
  });

  const events = eventsData?.data || [];

  const filterParams: Record<string, string> = {};
  if (statusFilter !== 'all') {
    filterParams.displayStatus = (STATUS_FILTERS.find((f) => f.id === statusFilter)?.statuses ?? []).join(',');
  }
  if (paymentFilter !== 'all') filterParams.paymentMethod = paymentFilter;
  if (query) filterParams.q = query;
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
    queryKey: ['orders', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter, query, page],
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
    queryKey: ['orders-stats', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter, query],
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
        <input
          className="input"
          type="search"
          style={{ flex: '2 1 200px', minWidth: 0 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('orders.filters.searchPlaceholder')}
          aria-label={t('orders.filters.searchPlaceholder')}
        />

        <select
          className="select"
          style={{ flex: '1 1 140px', minWidth: 0 }}
          value={statusFilter}
          onChange={(e) => updateFilter(setStatusFilter)(e.target.value)}
          aria-label={t('orders.columns.status')}
        >
          <option value="all">{t('orders.filters.allStatuses')}</option>
          {STATUS_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {t(`orders.displayStatus.${f.id}`)}
            </option>
          ))}
        </select>

        <select
          className="select"
          style={{ flex: '1 1 140px', minWidth: 0 }}
          value={paymentFilter}
          onChange={(e) => updateFilter(setPaymentFilter)(e.target.value as HistoryPaymentFilter | 'all')}
          aria-label={t('orders.columns.payment')}
        >
          <option value="all">{t('orders.filters.allPayments')}</option>
          {PAYMENT_FILTERS.map((m) => (
            <option key={m} value={m}>
              {t(`orders.history.payment.${m}`)}
            </option>
          ))}
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
          <Icon
            name="refresh"
            size={18}
            style={isFetching ? { animation: 'spin 0.75s linear infinite' } : undefined}
          />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <ShoppingBag size={28} />
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
                const display = order.displayStatus ?? 'in_kitchen';
                const methods = [...new Set((order as Order & { paymentMethods?: string[] }).paymentMethods ?? [])];
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
                      <span className={displayStatusBadge[display]}>{t(`orders.displayStatus.${display}`)}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 6, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                        {methods.map((m) => (
                          <span key={m} title={t(`orders.history.payment.${m === 'cash' ? 'cash' : m.startsWith('sumup') ? 'sumup' : 'card'}`)}>
                            <Icon name={paymentIcon(m)} size={16} />
                          </span>
                        ))}
                        {Number(order.discountAmount) > 0 && (
                          <span title={t('orders.history.payment.discount')}>
                            <Icon name="percent" size={16} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="mono text-right">
                      <div style={{ fontWeight: 600 }}>{formatCurrency(order.total)}</div>
                      {Number(order.refundedAmount) > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--danger)' }}>
                          {t('orders.history.refunded')}: {formatCurrency(-Number(order.refundedAmount))}
                        </div>
                      )}
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
