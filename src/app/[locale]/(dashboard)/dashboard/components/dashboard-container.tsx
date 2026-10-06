'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useEvents, useActiveEvent } from '@/hooks/use-events';
import { ordersApi } from '@/lib/api-client';
import { countOrderItems, recentOrdersQuery, RECENT_ORDERS_LIMIT } from '@/lib/recent-orders';
import { todayKey } from '@/utils/calendar-date';
import type { Order } from '@/types/order';
import { usePreferences, useUpdatePreferences } from '@/hooks/use-user-settings';
import { WIDGET_REGISTRY, DEFAULT_WIDGET_IDS } from './widgets/index';
import { DashboardGrid } from './dashboard-grid';
import { Building, ShoppingBag } from 'lucide-react';
import { Dropdown, DropdownCaption, DropdownOption, Icon } from '@openeos/ui';
import { DashboardRangeProvider, rangeFor, type RangeKey } from './dashboard-range';
import { SuperAdminDashboard } from './super-admin-dashboard';
import { ListEmpty } from '@/components/shared/list-states';
import type { DashboardWidgetSize } from '@/types/settings';
import { QuickStartCard } from './onboarding/quick-start-card';
import { useDeployment } from '@/components/providers/setup-provider';

const statusBadgeClass: Record<Order['status'], string> = {
  open: 'badge badge--warning',
  in_progress: 'badge badge--info',
  ready: 'badge badge--success',
  completed: 'badge badge--neutral',
  cancelled: 'badge badge--error',
};

export function DashboardContainer() {
  const t = useTranslations('dashboard');
  const tOrders = useTranslations('orders');
  const tCommon = useTranslations('common');
  const { formatCurrency, formatTime } = useLocaleFormat();
  const user = useAuthStore((state) => state.user);
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const deployment = useDeployment();

  /* Griffe erscheinen nur hier — sonst verschiebt jeder Scrollversuch
     die Anordnung. */
  const [isEditing, setIsEditing] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');

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

  /* Was noch nicht auf dem Brett liegt — die Auswahl zum Hinzufuegen. */
  const inactiveWidgets = useMemo(
    () => availableWidgets.filter((w) => !enabledIds.includes(w.id)),
    [availableWidgets, enabledIds],
  );

  const range = useMemo(
    () => rangeFor(rangeKey, activeEvent ?? undefined),
    [rangeKey, activeEvent?.startDate, activeEvent?.endDate],
  );

  // Fetch today's orders for recent-activity section
  // Local calendar day: toISOString() returned yesterday between 00:00 and
  // 02:00 in Berlin.
  const today = useMemo(() => todayKey(), []);

  const { data: ordersResponse, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', organizationId, 'today', today, 'recent'],
    queryFn: async () => {
      const response = await ordersApi.list(organizationId, recentOrdersQuery(today));
      return response.data;
    },
    enabled: !!organizationId,
  });

  const recentOrders = useMemo(() => {
    const orders = ordersResponse || [];
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_ORDERS_LIMIT);
  }, [ordersResponse]);

  const itemCountLabel = (order: Order) => {
    const count = countOrderItems(order);
    return count === null ? '—' : t('recentActivity.itemCount', { count });
  };


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

  /* Stand frueher ganz oben, noch vor einem Dutzend Hooks. Das verstiess
     gegen die Hook-Regeln: React verlangt, dass in jedem Durchlauf dieselben
     Hooks in derselben Reihenfolge laufen, und ein Rueckgabewert davor bricht
     genau das. Bemerkt hat es niemand, weil `isSuperAdmin` sich innerhalb
     einer Sitzung nie aendert — beim Wechsel waere die Anzeige jedoch mit
     einem Hook-Reihenfolgefehler stehengeblieben.

     Hier unten ist der Zweig unschaedlich: Alle Hooks sind gelaufen, und die
     Abfragen darueber haengen an `enabled: !!organizationId`, holen fuer
     einen Betreiber ohne Organisation also ohnehin nichts.

     Die Bedingung auf `multiTenant` stammt aus dem Self-Hosting-Zweig:
     eigenstaendig traegt der Administrator das Super-Admin-Recht nur, um an
     Geraete, Drucker und Protokoll zu kommen — eine Betreiberebene ueber der
     Organisation gibt es dort nicht, und das Plattform-Dashboard zaehlte ihm
     sonst Organisationen und Plattformumsatz vor statt sein Fest. */
  if (user?.isSuperAdmin && deployment.multiTenant) {
    return <SuperAdminDashboard />;
  }

  if (!organizationId) {
    return (
      <ListEmpty
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={
          <Building size={28} />
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
          {isEditing ? (
            /* Hinzufuegen gehoert in den Bearbeitungsmodus — sonst
               braeuchte es einen zweiten Knopf daneben, der dasselbe
               Thema aus einer anderen Richtung angeht. */
            <Dropdown
              label={t('customize.add')}
              triggerSize="sm"
              align="end"
              prefix={inactiveWidgets.length > 0 ? String(inactiveWidgets.length) : undefined}
            >
              {inactiveWidgets.length === 0 ? (
                <DropdownCaption>{t('customize.allAdded')}</DropdownCaption>
              ) : (
                inactiveWidgets.map((w) => (
                  <DropdownOption
                    key={w.id}
                    onClick={() => persist({ widgets: [...enabledIds, w.id] })}
                  >
                    {t(w.labelKey)}
                  </DropdownOption>
                ))
              )}
            </Dropdown>
          ) : (
            <div className="oe-segment" role="group" aria-label={t('range.label')} data-tour="dashboard-range">
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
            {!isEditing && (
              <Icon name="edit" size={14} />
            )}
            {isEditing ? t('customize.done') : t('customize.button')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Ganz oben, solange die Einrichtung laeuft — sie blendet sich
            selbst aus, sobald alle Schritte sitzen. */}
        <QuickStartCard organizationId={organizationId} />

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
                <ShoppingBag size={28} />
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
                  const badgeClass = statusBadgeClass[order.status] ?? 'badge badge--neutral';
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
                            {formatTime(order.createdAt)} · {itemCountLabel(order)}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>
                            {formatCurrency(order.total)}
                          </div>
                        </div>
                      </div>
                      <span className={badgeClass}>{tOrders(`status.${order.status}`)}</span>
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
                      const badgeClass = statusBadgeClass[order.status] ?? 'badge badge--neutral';
                      return (
                        <tr key={order.id}>
                          <td className="mono">#{order.dailyNumber}</td>
                          <td className="mono">{formatTime(order.createdAt)}</td>
                          <td>{itemCountLabel(order)}</td>
                          <td className="mono text-right">{formatCurrency(order.total)}</td>
                          <td>
                            <span className={badgeClass}>{tOrders(`status.${order.status}`)}</span>
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
    </>
  );
}
