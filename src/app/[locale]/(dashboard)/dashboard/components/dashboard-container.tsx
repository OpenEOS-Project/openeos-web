'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useEvents, useActiveEvent } from '@/hooks/use-events';
import { ordersApi } from '@/lib/api-client';
import type { Order } from '@/types/order';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_IDS } from './widgets/index';
import { CustomizeModal } from './customize-modal';
import { DashboardGrid } from './dashboard-grid';
import { DashboardRangeProvider, rangeFor, type RangeKey } from './dashboard-range';
import { SuperAdminDashboard } from './super-admin-dashboard';
import { ListEmpty } from '@/components/shared/list-states';
import type { DashboardWidgetSize } from '@/types/settings';

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
  /* Griffe erscheinen nur hier — sonst verschiebt jeder Scrollversuch
     die Anordnung. */
  const [isEditing, setIsEditing] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');

  if (user?.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const organizationId = currentOrganization?.organizationId || '';
  /* Fuer die Auswahl "Event": ohne laufende Veranstaltung bleibt der
     Knopf gesperrt. */
  const { data: activeEvent } = useActiveEvent(organizationId);
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

  /* Groessen aus den Voreinstellungen; fehlt ein Eintrag, greift die
     Vorgabe des Widget-Typs. */
  const sizes: DashboardWidgetSize[] | undefined = preferences?.dashboard?.sizes;

  const range = useMemo(
    () => rangeFor(rangeKey, activeEvent ?? undefined),
    [rangeKey, activeEvent?.startDate, activeEvent?.endDate],
  );

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
      { dashboard: { widgets: ids, sizes } },
      { onSuccess: () => setIsCustomizeOpen(false) },
    );
  }

  /* Reihenfolge, Groesse und Entfernen schreiben alle denselben
     Datensatz — sonst ueberschriebe der jeweils letzte Aufruf die
     Aenderung des vorherigen. */
  function persist(next: { widgets?: string[]; sizes?: DashboardWidgetSize[] }) {
    updatePreferences.mutate({
      dashboard: {
        widgets: next.widgets ?? enabledIds,
        sizes: next.sizes ?? sizes,
      },
    });
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
      <div className="app-page-head dash-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('title')}</h1>
          <p className="app-page-head__sub">
            {isEditing ? t('customize.editHint') : t('subtitle')}
          </p>
        </div>

        <div className="app-page-head__actions dash-head__actions">
        {isEditing ? null : (
          <div className="oe-segment" role="group" aria-label={t('range.label')}>
            {(['today', 'week', 'event'] as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={rangeKey === key}
                className={rangeKey === key ? 'is-active' : undefined}
                /* "Event" nur, wenn eine Veranstaltung laeuft — sonst
                   waere der Zeitraum leer und die Auswahl folgenlos. */
                disabled={key === 'event' && !activeEvent}
                onClick={() => setRangeKey(key)}
              >
                {t(`range.${key}`)}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={isEditing ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
          onClick={() => setIsEditing((v) => !v)}
        >
          {isEditing ? t('customize.done') : t('customize.arrange')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setIsCustomizeOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t('customize.button')}
        </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <DashboardRangeProvider value={range}>
          <DashboardGrid
          widgets={activeWidgets}
          sizes={sizes}
          organizationId={organizationId}
          editing={isEditing}
          onOrderChange={(ids) => persist({ widgets: ids })}
          onSizesChange={(next) => persist({ sizes: next })}
          onRemove={(id) => persist({ widgets: enabledIds.filter((w) => w !== id) })}
          />
        </DashboardRangeProvider>

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
