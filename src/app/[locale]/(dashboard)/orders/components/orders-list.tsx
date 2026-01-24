'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart01,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw01,
  CreditCard01,
  QrCode01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { ordersApi, eventsApi } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/utils/format';
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types/order';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const statusConfig: Record<OrderStatus, { color: BadgeColors; icon: typeof Clock }> = {
  open: { color: 'gray', icon: Clock },
  in_progress: { color: 'warning', icon: AlertCircle },
  ready: { color: 'brand', icon: CheckCircle },
  completed: { color: 'success', icon: CheckCircle },
  cancelled: { color: 'error', icon: XCircle },
};

const paymentStatusConfig: Record<OrderPaymentStatus, { color: BadgeColors; label: string }> = {
  unpaid: { color: 'error', label: 'orders.paymentStatus.unpaid' },
  partly_paid: { color: 'warning', label: 'orders.paymentStatus.partlyPaid' },
  paid: { color: 'success', label: 'orders.paymentStatus.paid' },
  refunded: { color: 'gray', label: 'orders.paymentStatus.refunded' },
};

const sourceIcons = {
  pos: CreditCard01,
  online: ShoppingCart01,
  qr_order: QrCode01,
};

export function OrdersList() {
  const t = useTranslations();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentStatus | 'all'>('all');
  const [eventFilter, setEventFilter] = useState<string | 'all'>('all');

  // Fetch events for filter
  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId,
  });

  const events = eventsData?.data || [];

  // Build query params
  const queryParams: Record<string, string> = { limit: '100', includeItems: 'true' };
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (paymentFilter !== 'all') queryParams.paymentStatus = paymentFilter;
  if (eventFilter !== 'all') queryParams.eventId = eventFilter;

  const { data: ordersData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders', organizationId, statusFilter, paymentFilter, eventFilter],
    queryFn: () => ordersApi.list(organizationId!, queryParams as any),
    enabled: !!organizationId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const orders = ordersData?.data || [];

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-secondary p-4">
        <Select
          selectedKey={statusFilter}
          onSelectionChange={(key) => setStatusFilter(key as OrderStatus | 'all')}
          className="w-40"
        >
          <Select.Item id="all">{t('orders.filters.allStatuses')}</Select.Item>
          <Select.Item id="open">{t('orders.status.open')}</Select.Item>
          <Select.Item id="in_progress">{t('orders.status.inProgress')}</Select.Item>
          <Select.Item id="ready">{t('orders.status.ready')}</Select.Item>
          <Select.Item id="completed">{t('orders.status.completed')}</Select.Item>
          <Select.Item id="cancelled">{t('orders.status.cancelled')}</Select.Item>
        </Select>

        <Select
          selectedKey={paymentFilter}
          onSelectionChange={(key) => setPaymentFilter(key as OrderPaymentStatus | 'all')}
          className="w-40"
        >
          <Select.Item id="all">{t('orders.filters.allPayments')}</Select.Item>
          <Select.Item id="unpaid">{t('orders.paymentStatus.unpaid')}</Select.Item>
          <Select.Item id="partly_paid">{t('orders.paymentStatus.partlyPaid')}</Select.Item>
          <Select.Item id="paid">{t('orders.paymentStatus.paid')}</Select.Item>
          <Select.Item id="refunded">{t('orders.paymentStatus.refunded')}</Select.Item>
        </Select>

        {events.length > 0 && (
          <Select
            selectedKey={eventFilter}
            onSelectionChange={(key) => setEventFilter(key as string)}
            className="w-48"
          >
            <Select.Item id="all">{t('orders.filters.allEvents')}</Select.Item>
            {events.map((event) => (
              <Select.Item key={event.id} id={event.id}>
                {event.name}
              </Select.Item>
            ))}
          </Select>
        )}

        <div className="flex-1" />

        <span className="text-sm text-tertiary">
          {t('orders.orderCount', { count: orders.length })}
        </span>

        <Button
          color="secondary"
          size="sm"
          onClick={() => refetch()}
          isDisabled={isFetching}
          iconLeading={RefreshCw01}
          className={isFetching ? '[&_[data-icon]]:animate-spin' : ''}
        >
          {t('common.refresh')}
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon="shopping-cart"
            title={t('orders.noOrders')}
            description={t('orders.noOrdersDescription')}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.orderNumber')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.table')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.items')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.status')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.payment')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">
                  {t('orders.columns.total')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                  {t('orders.columns.createdAt')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {orders.map((order: Order) => {
                const config = statusConfig[order.status];
                const StatusIcon = config.icon;
                const paymentConfig = paymentStatusConfig[order.paymentStatus];
                const SourceIcon = sourceIcons[order.source] || ShoppingCart01;

                return (
                  <tr key={order.id} className="hover:bg-secondary/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          <SourceIcon className="h-5 w-5 text-tertiary" />
                        </div>
                        <div>
                          <p className="font-medium text-primary">#{order.dailyNumber}</p>
                          <p className="text-xs text-tertiary">{order.orderNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-secondary">
                        {order.tableNumber || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-0.5">
                            {order.items.slice(0, 2).map((item) => (
                              <p key={item.id} className="text-sm text-secondary truncate">
                                {item.quantity}x {item.productName}
                              </p>
                            ))}
                            {order.items.length > 2 && (
                              <p className="text-xs text-tertiary">
                                +{order.items.length - 2} {t('orders.moreItems')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-tertiary">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={config.color} size="sm">
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {t(`orders.status.${order.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={paymentConfig.color} size="sm">
                        {t(paymentConfig.label)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-primary">
                        {formatCurrency(order.total)}
                      </span>
                      {order.paidAmount > 0 && order.paidAmount < order.total && (
                        <p className="text-xs text-tertiary">
                          {t('orders.paid')}: {formatCurrency(order.paidAmount)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-tertiary">
                        {formatDate(order.createdAt)}
                      </span>
                    </td>
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
