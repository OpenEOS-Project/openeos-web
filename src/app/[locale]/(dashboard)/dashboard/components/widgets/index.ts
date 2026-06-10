import type { WidgetDefinition } from './widget-registry';
import { OrdersTodayWidget } from './orders-today-widget';
import { RevenueTodayWidget } from './revenue-today-widget';
import { ActiveEventsWidget } from './active-events-widget';
import { ActiveUsersWidget } from './active-users-widget';
import { TopProductsWidget } from './top-products-widget';
import { HourlyRevenueWidget } from './hourly-revenue-widget';
import { PaymentMethodsWidget } from './payment-methods-widget';
import { LowStockWidget } from './low-stock-widget';

export { DEFAULT_WIDGET_IDS } from './widget-registry';
export type { WidgetId } from './widget-registry';

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'ordersToday',
    labelKey: 'widgets.ordersToday.label',
    type: 'stat',
    Component: OrdersTodayWidget,
  },
  {
    id: 'revenueToday',
    labelKey: 'widgets.revenueToday.label',
    type: 'stat',
    Component: RevenueTodayWidget,
  },
  {
    id: 'activeEvents',
    labelKey: 'widgets.activeEvents.label',
    type: 'stat',
    Component: ActiveEventsWidget,
  },
  {
    id: 'activeUsers',
    labelKey: 'widgets.activeUsers.label',
    type: 'stat',
    Component: ActiveUsersWidget,
  },
  {
    id: 'topProducts',
    labelKey: 'widgets.topProducts.label',
    requiredPermission: 'reports',
    type: 'card',
    Component: TopProductsWidget,
  },
  {
    id: 'hourlyRevenue',
    labelKey: 'widgets.hourlyRevenue.label',
    requiredPermission: 'reports',
    type: 'card',
    Component: HourlyRevenueWidget,
  },
  {
    id: 'paymentMethods',
    labelKey: 'widgets.paymentMethods.label',
    requiredPermission: 'reports',
    type: 'card',
    Component: PaymentMethodsWidget,
  },
  {
    id: 'lowStock',
    labelKey: 'widgets.lowStock.label',
    requiredPermission: 'reports',
    type: 'card',
    Component: LowStockWidget,
  },
];
