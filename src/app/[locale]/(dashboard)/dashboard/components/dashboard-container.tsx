'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useEvents } from '@/hooks/use-events';
import { ordersApi } from '@/lib/api-client';
import type { Order } from '@/types/order';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_IDS } from './widgets/index';
import { CustomizeModal } from './customize-modal';
import { SuperAdminDashboard } from './super-admin-dashboard';
import { ListEmpty } from '@/components/shared/list-states';

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

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  if (user?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const organizationId = currentOrganization?.organizationId || '';
  const role = currentOrganization?.role;
  const permissions = currentOrganization?.permissions;

  // Preferences for widget config
  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  // Resolve enabled widget ids from preferences (fall back to default)
  const enabledIds: string[] = useMemo(() => {
    const saved = preferences?.dashboard?.widgets;
    if (saved && saved.length > 0) return saved;
    return [...DEFAULT_WIDGET_IDS];
  }, [preferences]);

  // Permission check: mirrors canSeeNavItem logic from app-sidebar
  function canSeeWidget(requiredPermission?: 'reports'): boolean {
    if (!requiredPermission) return true;
    if (role === 'admin') return true;
    return !!permissions?.[requiredPermission];
  }

  // Available widgets for this user (all registry entries they have permission for)
  const availableWidgets = useMemo(
    () => WIDGET_REGISTRY.filter((w) => canSeeWidget(w.requiredPermission)),
    [role, permissions],
  );

  // Widgets to render: in saved order, filtered to available
  const activeWidgets = useMemo(() => {
    const availableIds = new Set(availableWidgets.map((w) => w.id));
    return enabledIds
      .filter((id) => availableIds.has(id))
      .map((id) => availableWidgets.find((w) => w.id === id)!)
      .filter(Boolean);
  }, [enabledIds, availableWidgets]);

  const statWidgets = activeWidgets.filter((w) => w.type === 'stat');
  const cardWidgets = activeWidgets.filter((w) => w.type === 'card');

  // Fetch today's orders for recent-activity section
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: ordersResponse, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', organizationId, 'today', today],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, { dateFrom: today, dateTo: today });
      return response.data;
    },
    enabled: !!organizationId,
  });

  const recentOrders = useMemo(() => {
    const orders = ordersResponse || [];
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [ordersResponse]);

  function handleSave(ids: string[]) {
    updatePreferences.mutate(
      { dashboard: { widgets: ids } },
      { onSuccess: () => setIsCustomizeOpen(false) },
    );
  }

  if (!organizationId) {
    return (
      <ListEmpty
        title="Keine Organisation ausgewählt"
        description="Bitte wählen Sie zuerst eine Organisation aus."
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
          </svg>
        }
      />
    );
  }

  return (
    <>
      {/* Page header row with Anpassen button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: -8 }}>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setIsCustomizeOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t('customize.button')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat widgets grid */}
        {statWidgets.length > 0 && (
          <div className="stat-cards">
            {statWidgets.map((widget) => (
              <widget.Component key={widget.id} organizationId={organizationId} />
            ))}
          </div>
        )}

        {/* Card widgets */}
        {cardWidgets.map((widget) => (
          <widget.Component key={widget.id} organizationId={organizationId} />
        ))}

        {/* Recent activity — always shown */}
        <div className="app-card app-card--flat">
          <div className="app-card__head">
            <div>
              <h2 className="app-card__title">{t('recentActivity.title')}</h2>
              <p className="app-card__sub">{t('recentActivity.subtitle')}</p>
            </div>
          </div>

          {isLoadingOrders ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
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
                style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}
                className="md:hidden"
              >
                {recentOrders.map((order) => {
                  const badge = statusBadge[order.status] ?? { cls: 'badge badge--neutral', label: order.status };
                  return (
                    <div
                      key={order.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))', color: 'var(--green-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--f-mono)', flexShrink: 0 }}>
                          #{order.dailyNumber}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                            {formatTime(order.createdAt)} · {order.items?.length ?? 0} Artikel
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>
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

      {/* Customize modal */}
      {isCustomizeOpen && (
        <CustomizeModal
          enabledIds={enabledIds}
          availableWidgets={availableWidgets}
          onSave={handleSave}
          onClose={() => setIsCustomizeOpen(false)}
          isSaving={updatePreferences.isPending}
        />
      )}
    </>
  );
}
