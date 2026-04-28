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
import { SuperAdminDashboard } from './super-admin-dashboard';

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
      return 'text-warning-700 dark:text-warning-400';
    case 'in_progress':
      return 'text-brand-700 dark:text-brand-400';
    case 'ready':
      return 'text-success-700 dark:text-success-400';
    case 'completed':
      return 'text-tertiary';
    case 'cancelled':
      return 'text-error-700 dark:text-error-400';
    default:
      return 'text-tertiary';
  }
}

function getStatusBg(status: Order['status']): string {
  switch (status) {
    case 'open':
      return 'bg-warning-50 dark:bg-warning-950';
    case 'in_progress':
      return 'bg-brand-50 dark:bg-brand-950';
    case 'ready':
      return 'bg-success-50 dark:bg-success-950';
    case 'completed':
      return 'bg-secondary';
    case 'cancelled':
      return 'bg-error-50 dark:bg-error-950';
    default:
      return 'bg-secondary';
  }
}

export function DashboardContainer() {
  const t = useTranslations('dashboard');
  const tOrders = useTranslations('orders');
  const user = useAuthStore((state) => state.user);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);

  if (user?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }
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
        dateFrom: today,
        dateTo: today,
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
    const activeEvents = events?.filter((e) => e.status === 'active' || e.status === 'test') || [];
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
    <div className="space-y-4 sm:space-y-6">
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
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-primary">{t('recentActivity.title')}</h2>
            <p className="mt-0.5 text-sm text-tertiary">{t('recentActivity.subtitle')}</p>
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="flex items-center justify-center border-t border-secondary py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="size-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <span className="text-sm text-tertiary">Laden...</span>
            </div>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="border-t border-secondary">
            <EmptyState
              icon="shopping-bag"
              title={t('recentActivity.empty.title')}
              description={t('recentActivity.empty.description')}
              className="px-5 py-8"
            />
          </div>
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="divide-y divide-secondary border-t border-secondary md:hidden">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                      #{order.dailyNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">{formatTime(order.createdAt)}</span>
                        <span className="text-xs text-quaternary">{order.items?.length || 0} Artikel</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)} ${getStatusBg(order.status)}`}>
                    {tOrders(`status.${order.status}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden overflow-hidden border-t border-secondary md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-secondary bg-secondary">
                    <th className="px-5 py-3 text-left text-xs font-medium text-tertiary">
                      {tOrders('columns.orderNumber')}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-tertiary">
                      {tOrders('columns.createdAt')}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-tertiary">
                      {tOrders('columns.items')}
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-tertiary">
                      {tOrders('columns.total')}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-tertiary">
                      {tOrders('columns.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-primary_hover">
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-primary">
                        #{order.dailyNumber}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-tertiary">
                        {formatTime(order.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-tertiary">
                        {order.items?.length || 0} Artikel
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-sm font-medium text-primary">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)} ${getStatusBg(order.status)}`}>
                          {tOrders(`status.${order.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
