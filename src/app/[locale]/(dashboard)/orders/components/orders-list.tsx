'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dropdown,
  DropdownCaption,
  DropdownOption,
  Icon,
  Input,
  SearchInput,
  Select,
  Tooltip,
  useMediaQuery,
  type DataColumn,
} from '@openeos/ui';
import { ShoppingBag } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { ordersApi, eventsApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { toast } from '@/components/shared/toast';
import { saveBlob } from '@/lib/dsfinvk';
import { getOrderChannel, type Order, type OrderChannel, type OrdersExportVariant } from '@/types/order';
import type { HistoryPaymentFilter } from '@/types/order-history';
import { STATUS_FILTERS, paymentIcon, paymentKey } from '@/utils/order-history';
import { OrderDetailModal, displayStatusBadge } from './order-detail-modal';
import {
  AdminFilterBar,
  AdminPager,
  AdminTable,
  CellMain,
  CellNone,
  ListAction,
  PHONE_QUERY,
} from '@/components/shared/admin-table';

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

const EXPORT_VARIANTS: OrdersExportVariant[] = ['orders', 'items'];

/** Heutiges Datum (lokal) für den Ersatz-Dateinamen. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  // Zeitraum (lokale Kalendertage, die API dehnt auf Tagesbeginn/-ende).
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const { hasPermission } = usePermissions();
  // Export wie Storno und Erstattung: Admin oder Recht „Bestellungen“ (die API prüft dasselbe).
  const mayExport = hasPermission('orders');
  const apiErrorMessage = useApiErrorMessage();
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);

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
  if (dateFrom) filterParams.dateFrom = dateFrom;
  if (dateTo) filterParams.dateTo = dateTo;

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
    isPlaceholderData: isPreviousOrders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['orders', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter, dateFrom, dateTo, query, page],
    queryFn: () => ordersApi.list(organizationId!, listParams as never),
    enabled: !!organizationId,
    refetchInterval: 10000,
    // Beim Filtern die bisherige Liste stehen lassen (abgedunkelt), statt
    // alles samt Filterzeile und offenem Filter-Sheet neu aufzubauen.
    placeholderData: keepPreviousData,
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
    queryKey: ['orders-stats', organizationId, statusFilter, paymentFilter, channelFilter, eventFilter, dateFrom, dateTo, query],
    queryFn: () => ordersApi.stats(organizationId!, filterParams as never),
    enabled: !!organizationId,
    refetchInterval: 10000,
    placeholderData: keepPreviousData,
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

  /** Lädt die gefilterten Bestellungen als CSV (alle Seiten, wie die Kennzahlen). */
  const handleExport = async (variant: OrdersExportVariant) => {
    if (!organizationId || exporting) return;
    setExporting(true);
    try {
      const file = await ordersApi.exportCsv(organizationId, { ...filterParams, variant });
      saveBlob(file.blob, file.filename ?? t(`orders.export.filename.${variant}`, { date: todayKey() }));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('orders.export.failed')));
    } finally {
      setExporting(false);
    }
  };

  const creatorLabel = (order: Order): string | null => {
    if (order.createdByUser) {
      return `${order.createdByUser.firstName} ${order.createdByUser.lastName}`.trim();
    }
    if (order.createdByDevice?.name) return order.createdByDevice.name;
    return null;
  };

  const columns: DataColumn<Order>[] = [
    {
      id: 'order',
      header: t('orders.columns.orderNumber'),
      mobile: 'title',
      cell: (order) => {
        const title = order.tableNumber
          ? t('orders.tableLabel', { table: order.tableNumber })
          : order.customerName || `#${order.dailyNumber}`;
        return (
          <CellMain
            media={<span className="orders-list__no">#{order.dailyNumber}</span>}
            title={title}
            titleText={title}
            sub={<span className="orders-list__number">{order.orderNumber}</span>}
          />
        );
      },
    },
    {
      id: 'channel',
      header: t('orders.columns.channel'),
      priority: 2,
      cell: (order) => {
        const channel = getOrderChannel(order);
        const creator = creatorLabel(order);
        return (
          <span className="orders-list__channel">
            <span className={channelBadge[channel]}>{t(`orders.channel.${channel}`)}</span>
            {order.waiter && (
              <span data-testid="order-waiter" title={order.waiter.name} className="orders-list__waiter">
                <i aria-hidden style={{ background: order.waiter.color ?? 'var(--oe-ink)' }} />
                {order.waiter.name}
              </span>
            )}
            {creator && <span className="orders-list__creator" title={creator}>{creator}</span>}
          </span>
        );
      },
    },
    {
      id: 'items',
      header: t('orders.columns.items'),
      priority: 3,
      cell: (order) =>
        order.items && order.items.length > 0 ? (
          <span className="orders-list__items">
            {order.items.slice(0, 2).map((item) => (
              <span
                key={item.id}
                // Stornierte Positionen durchgestrichen, wie in der Kasse.
                className={item.status === 'cancelled' ? 'is-cancelled' : undefined}
                title={`${item.quantity}x ${item.productName}`}
              >
                {item.quantity}x {item.productName}
              </span>
            ))}
            {order.items.length > 2 && (
              <span className="orders-list__more">+{order.items.length - 2} {t('orders.moreItems')}</span>
            )}
          </span>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'status',
      header: t('orders.columns.status'),
      mobile: 'subtitle',
      cell: (order) => {
        const display = order.displayStatus ?? 'in_kitchen';
        return <span className={displayStatusBadge[display]}>{t(`orders.displayStatus.${display}`)}</span>;
      },
    },
    {
      id: 'payment',
      header: t('orders.columns.payment'),
      // Kleine Symbole: auf Tablet und Telefon (Zeile 2) sichtbar lassen.
      mobile: 'meta',
      cell: (order) => {
        const methods = [...new Set((order as Order & { paymentMethods?: string[] }).paymentMethods ?? [])];
        return (
          <span className="orders-list__payment">
            {methods.map((m) => (
              <span key={m} title={t(`orders.history.payment.${paymentKey(m)}`)}>
                <Icon name={paymentIcon(m)} size={16} />
              </span>
            ))}
            {Number(order.discountAmount) > 0 && (
              <span title={t('orders.history.payment.discount')}>
                <Icon name="percent" size={16} />
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: 'total',
      header: t('orders.columns.total'),
      num: true,
      mobile: 'trailing',
      cell: (order) => (
        <span className="orders-list__total">
          <strong>{formatCurrency(order.total)}</strong>
          {Number(order.refundedAmount) > 0 && (
            <span className="orders-list__refunded">
              {t('orders.history.refunded')}: {formatCurrency(-Number(order.refundedAmount))}
            </span>
          )}
          {order.paidAmount > 0 && order.paidAmount < order.total && (
            <span className="orders-list__paid">
              {t('orders.paid')}: {formatCurrency(order.paidAmount)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: t('orders.columns.createdAt'),
      mobile: 'meta',
      className: 'orders-list__date',
      cell: (order) => formatDateTime(order.createdAt),
    },
  ];

  const activeFilters = [
    statusFilter !== 'all',
    paymentFilter !== 'all',
    channelFilter !== 'all',
    !!dateFrom,
    !!dateTo,
    eventFilter !== 'all',
  ].filter(Boolean).length;
  const resetFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setChannelFilter('all');
    setDateFrom('');
    setDateTo('');
    setEventFilter('all');
    setPage(1);
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
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

      {/* Filter: Suche immer sichtbar, die übrigen Felder auf dem Telefon
          hinter dem Filter-Knopf (Sheet). */}
      <AdminFilterBar
        leading={
          <SearchInput
            className="orders-list__search"
            icon={<Icon name="search" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('orders.filters.searchPlaceholder')}
            aria-label={t('orders.filters.searchPlaceholder')}
          />
        }
        activeCount={activeFilters}
        onReset={resetFilters}
        actions={
          <>
            <span className="orders-list__count">{t('orders.orderCount', { count: summary.count })}</span>
            {/* Nur Symbole, Beschriftung als Tooltip bei Zeigen, Fokus oder
                langem Drücken. Exportiert wird, was die Filter zeigen. */}
            {mayExport && (
              <Tooltip label={t('orders.export.trigger')} placement="bottom">
                <Dropdown
                  triggerVariant="icon"
                  align="end"
                  aria-label={t('orders.export.trigger')}
                  trigger={<Icon name={exporting ? 'refresh' : 'download'} className={exporting ? 'admin-spin' : undefined} />}
                >
                  <DropdownCaption>{t('orders.export.caption', { count: summary.count })}</DropdownCaption>
                  {EXPORT_VARIANTS.map((variant) => (
                    <DropdownOption
                      key={variant}
                      disabled={exporting || summary.count === 0}
                      onClick={() => void handleExport(variant)}
                      meta={t(`orders.export.${variant}Hint`)}
                    >
                      {t(`orders.export.${variant}`)}
                    </DropdownOption>
                  ))}
                </Dropdown>
              </Tooltip>
            )}
            <ListAction
              icon={<Icon name="refresh" className={isFetching ? 'admin-spin' : undefined} />}
              label={t('common.refresh')}
              onClick={() => refetch()}
              disabled={isFetching}
            />
          </>
        }
      >
        {/* Auf dem Telefon stehen die Felder im Sheet, dort mit Beschriftung. */}
        <Select
          label={phone ? t('orders.columns.status') : undefined}
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
        </Select>

        <Select
          label={phone ? t('orders.columns.payment') : undefined}
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
        </Select>

        <Select
          label={phone ? t('orders.columns.channel') : undefined}
          value={channelFilter}
          onChange={(e) => updateFilter(setChannelFilter)(e.target.value as OrderChannel | 'all')}
          aria-label={t('orders.columns.channel')}
        >
          <option value="all">{t('orders.filters.allChannels')}</option>
          <option value="service">{t('orders.channel.service')}</option>
          <option value="counter">{t('orders.channel.counter')}</option>
          <option value="online">{t('orders.channel.online')}</option>
        </Select>

        <Input
          label={phone ? t('orders.filters.dateFrom') : undefined}
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => updateFilter(setDateFrom)(e.target.value)}
          aria-label={t('orders.filters.dateFrom')}
          title={t('orders.filters.dateFrom')}
        />
        <Input
          label={phone ? t('orders.filters.dateTo') : undefined}
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => updateFilter(setDateTo)(e.target.value)}
          aria-label={t('orders.filters.dateTo')}
          title={t('orders.filters.dateTo')}
        />

        {events.length > 0 && (
          <Select
            label={phone ? t('orders.filters.event') : undefined}
            value={eventFilter}
            onChange={(e) => updateFilter(setEventFilter)(e.target.value)}
            aria-label={t('orders.filters.allEvents')}
          >
            <option value="all">{t('orders.filters.allEvents')}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </Select>
        )}
      </AdminFilterBar>

      <AdminTable
        caption={t('orders.title')}
        rows={orders}
        rowKey="id"
        columns={columns}
        onRowClick={(order) => setSelectedOrder(order)}
        loading={isPreviousOrders && isFetchingOrders}
        empty={
          <div className="empty-state">
            <div className="empty-state__icon">
              <ShoppingBag size={28} />
            </div>
            <h3 className="empty-state__title">{t('orders.noOrders')}</h3>
            <p className="empty-state__sub">{t('orders.noOrdersDescription')}</p>
          </div>
        }
        footer={
          meta && meta.total > PAGE_LIMIT ? (
            <AdminPager page={meta.page} pageSize={PAGE_LIMIT} total={meta.total} onChange={(p) => setPage(p)} />
          ) : undefined
        }
      />

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
