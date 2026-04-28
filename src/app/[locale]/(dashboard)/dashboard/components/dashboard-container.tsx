'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

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

const statusBadge: Record<Order['status'], { cls: string; label: string }> = {
  open: { cls: 'badge badge--warning', label: 'Offen' },
  in_progress: { cls: 'badge badge--info', label: 'In Bearbeitung' },
  ready: { cls: 'badge badge--success', label: 'Bereit' },
  completed: { cls: 'badge badge--neutral', label: 'Abgeschlossen' },
  cancelled: { cls: 'badge badge--error', label: 'Storniert' },
};

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
    refetchInterval: 30000,
  });

  // Calculate stats
  const stats = useMemo(() => {
    const orders = ordersResponse || [];
    const activeEvents = events?.filter((e) => e.status === 'active' || e.status === 'test') || [];
    const onlineDevices = onlineDevicesResponse || [];

    const validOrders = orders.filter((o) => o.status !== 'cancelled');
    const ordersCount = validOrders.length;

    const revenue = validOrders
      .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partly_paid')
      .reduce((sum, o) => sum + o.paidAmount, 0);

    return {
      ordersToday: ordersCount,
      revenue,
      activeEvents: activeEvents.length,
      activeDevices: onlineDevices.length,
    };
  }, [ordersResponse, events, onlineDevicesResponse]);

  // Recent orders (last 10)
  const recentOrders = useMemo(() => {
    const orders = ordersResponse || [];
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [ordersResponse]);

  const isLoading = isLoadingEvents || isLoadingOrders;

  if (!organizationId) {
    return (
      <div className="app-card">
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
          </div>
          <h3 className="empty-state__title">Keine Organisation ausgewählt</h3>
          <p className="empty-state__sub">Bitte wählen Sie zuerst eine Organisation aus.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.ordersToday')}</div>
          <div className="stat-card__value">{isLoading ? '—' : stats.ordersToday}</div>
          <div className="stat-card__sub">{t('stats.vsYesterday')}</div>
        </div>
        <div className="stat-card stat-card--accent">
          <div className="stat-card__label">{t('stats.revenue')}</div>
          <div className="stat-card__value">{isLoading ? '—' : formatCurrency(stats.revenue)}</div>
          <div className="stat-card__sub">{t('stats.vsYesterday')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.activeEvents')}</div>
          <div className="stat-card__value">{isLoading ? '—' : stats.activeEvents}</div>
          <div className="stat-card__sub">{t('stats.eventsRunning')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('stats.activeUsers')}</div>
          <div className="stat-card__value">{stats.activeDevices}</div>
          <div className="stat-card__sub">{t('stats.usersOnline')}</div>
        </div>
      </div>

      {/* Recent activity card */}
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('recentActivity.title')}</h2>
            <p className="app-card__sub">{t('recentActivity.subtitle')}</p>
          </div>
        </div>

        {isLoadingOrders ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid var(--green-ink)',
                borderTopColor: 'transparent',
                animation: 'spin 0.75s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('recentActivity.empty.title')}</h3>
            <p className="empty-state__sub">{t('recentActivity.empty.description')}</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div
              style={{
                borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
              }}
              className="md:hidden"
            >
              {recentOrders.map((order) => {
                const badge = statusBadge[order.status] ?? { cls: 'badge badge--neutral', label: order.status };
                return (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: 'var(--f-mono)',
                          flexShrink: 0,
                        }}
                      >
                        #{order.dailyNumber}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          {formatTime(order.createdAt)} · {order.items?.length ?? 0} Artikel
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--ink)',
                            fontFamily: 'var(--f-mono)',
                          }}
                        >
                          {formatCurrency(order.total)}
                        </div>
                      </div>
                    </div>
                    <span className={badge.cls}>{tOrders(`status.${order.status}`)}</span>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div style={{ overflowX: 'auto' }} className="hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{tOrders('columns.orderNumber')}</th>
                    <th>{tOrders('columns.createdAt')}</th>
                    <th>{tOrders('columns.items')}</th>
                    <th className="text-right">{tOrders('columns.total')}</th>
                    <th>{tOrders('columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const badge = statusBadge[order.status] ?? { cls: 'badge badge--neutral', label: order.status };
                    return (
                      <tr key={order.id}>
                        <td className="mono">#{order.dailyNumber}</td>
                        <td className="mono">{formatTime(order.createdAt)}</td>
                        <td>{order.items?.length ?? 0} Artikel</td>
                        <td className="mono text-right">{formatCurrency(order.total)}</td>
                        <td>
                          <span className={badge.cls}>{tOrders(`status.${order.status}`)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
