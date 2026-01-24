'use client';

import type { ReactNode } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CreditCard02,
  ShoppingBag01,
  Users01,
} from '@untitledui/icons';

import { cx } from '@/utils/cx';

const iconMap = {
  'shopping-bag': ShoppingBag01,
  'credit-card': CreditCard02,
  calendar: Calendar,
  users: Users01,
} as const;

type IconName = keyof typeof iconMap;

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  subtitle?: string;
  icon?: IconName;
  className?: string;
}

export function StatsCard({ title, value, change, subtitle, icon, className }: StatsCardProps) {
  const Icon = icon ? iconMap[icon] : null;

  return (
    <div className={cx('rounded-xl border border-secondary bg-primary p-6 shadow-xs', className)}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-tertiary">{title}</p>
          <p className="text-display-sm font-semibold text-primary">{value}</p>
        </div>
        {Icon && (
          <div className="flex size-12 items-center justify-center rounded-lg border border-secondary bg-primary shadow-xs">
            <Icon className="size-6 text-fg-quaternary" />
          </div>
        )}
      </div>

      {(change || subtitle) && (
        <div className="mt-4 flex items-center gap-2">
          {change && (
            <span
              className={cx(
                'inline-flex items-center gap-1 text-sm font-medium',
                change.type === 'increase' ? 'text-success-600' : 'text-error-600'
              )}
            >
              {change.type === 'increase' ? (
                <ArrowUp className="size-4" />
              ) : (
                <ArrowDown className="size-4" />
              )}
              {Math.abs(change.value)}%
            </span>
          )}
          {subtitle && <span className="text-sm text-tertiary">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

interface StatsGridProps {
  children: ReactNode;
  className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cx('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>
  );
}
