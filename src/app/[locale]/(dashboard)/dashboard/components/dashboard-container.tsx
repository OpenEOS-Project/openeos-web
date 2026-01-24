'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { StatsCard, StatsGrid } from '@/components/ui/stats-card/stats-card';
import { useAuthStore } from '@/stores/auth-store';
import { useEvents } from '@/hooks/use-events';
import { ordersApi, devicesApi } from '@/lib/api-client';
import type { Order } from '@/types/order';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function getStatusColor(status: Order['status']): string {
  switch (status) {
    case 'open':
      return 'text-warning-primary';
    case 'in_progress':
      return 'text-brand-primary';
    case 'ready':
      return 'text-success-primary';
    case 'completed':
      return 'text-tertiary';
    case 'cancelled':
      return 'text-error-primary';
    default:
      return 'text-tertiary';
  }
}

export function DashboardContainer() {
  const t = useTranslations('dashboard');
  const tOrders = useTranslations('orders');
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';

  // Fetch events
  const { data: events, isLoading: isLoadingEvents } = useEvents(organizationId);

  // Fetch today's orders
  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const { data: ordersResponse, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', organizationId, 'today', today],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, {
        from: today,
        to: today,
      });
      return response.data;
    },
    enabled: !!organizationId,
  });

  // Fetch online devices
  const { data: onlineDevicesResponse } = useQuery({
    queryKey: ['devices', organizationId, 'online'],
    queryFn: async () => {
      const response = await devicesApi.getOnlineIds(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate stats
  const stats = useMemo(() => {
    const orders = ordersResponse || [];
    const activeEvents = events?.filter((e) => e.status === 'active') || [];
    const onlineDevices = onlineDevicesResponse || [];

    // Orders today (excluding cancelled)
    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const ordersCount = validOrders.length;

    // Revenue today (only paid orders)
    const revenue = validOrders
      .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partly_paid')
      .reduce((sum, o) => sum + o.paidAmount, 0);

    return {
      ordersToday: ordersCount,
      revenue: revenue,
      activeEvents: activeEvents.length,
      activeDevices: onlineDevices.length,
    };
  }, [ordersResponse, events, onlineDevicesResponse]);

  // Recent orders (last 10, sorted by creation date)
  const recentOrders = useMemo(() => {
    const orders = ordersResponse || [];
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [ordersResponse]);

  const isLoading = isLoadingEvents || isLoadingOrders;

  if (!organizationId) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <EmptyState
          icon="building"
          title="Keine Organisation ausgewählt"
          description="Bitte wählen Sie zuerst eine Organisation aus."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsGrid>
        <StatsCard
          title={t('stats.ordersToday')}
          value={isLoading ? '...' : String(stats.ordersToday)}
          subtitle={t('stats.vsYesterday')}
          icon="shopping-bag"
        />
        <StatsCard
          title={t('stats.revenue')}
          value={isLoading ? '...' : formatCurrency(stats.revenue)}
          subtitle={t('stats.vsYesterday')}
          icon="credit-card"
        />
        <StatsCard
          title={t('stats.activeEvents')}
          value={isLoading ? '...' : String(stats.activeEvents)}
          subtitle={t('stats.eventsRunning')}
          icon="calendar"
        />
        <StatsCard
          title={t('stats.activeUsers')}
          value={String(stats.activeDevices)}
          subtitle={t('stats.usersOnline')}
          icon="users"
        />
      </StatsGrid>

      {/* Recent Activity Section */}
      <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-primary">{t('recentActivity.title')}</h2>
        <p className="mt-1 text-sm text-tertiary">{t('recentActivity.subtitle')}</p>

        {isLoadingOrders ? (
          <div className="mt-6 flex items-center justify-center py-8">
            <div className="text-tertiary">Laden...</div>
          </div>
        ) : recentOrders.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title={t('recentActivity.empty.title')}
            description={t('recentActivity.empty.description')}
            className="mt-6"
          />
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-secondary">
            <table className="w-full">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                    {tOrders('columns.orderNumber')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                    {tOrders('columns.createdAt')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                    {tOrders('columns.items')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                    {tOrders('columns.total')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
                    {tOrders('columns.status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary/30">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">
                      #{order.dailyNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary">
                      {formatTime(order.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary">
                      {order.items?.length || 0} {order.items?.length === 1 ? 'Artikel' : 'Artikel'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`text-sm font-medium ${getStatusColor(order.status)}`}>
                        {tOrders(`status.${order.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
