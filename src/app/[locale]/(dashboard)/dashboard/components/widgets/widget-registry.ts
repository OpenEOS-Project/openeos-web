import type { ComponentType } from 'react';

export interface WidgetDefinition {
  id: string;
  /** Translation key under dashboard.widgets.<id>.label */
  labelKey: string;
  /** If set, user needs this permission (or admin role) to see this widget */
  requiredPermission?: 'reports';
  /** 'stat' widgets render in the stat-cards grid; 'card' widgets render in full-width sections below */
  type: 'stat' | 'card';
  Component: ComponentType<{ organizationId: string }>;
}

// Registry is populated lazily to avoid circular imports – consumers import from index.ts
export const WIDGET_IDS = [
  'ordersToday',
  'revenueToday',
  'activeEvents',
  'activeUsers',
  'topProducts',
  'hourlyRevenue',
  'paymentMethods',
  'lowStock',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const DEFAULT_WIDGET_IDS: WidgetId[] = [
  'ordersToday',
  'revenueToday',
  'activeEvents',
  'activeUsers',
];
