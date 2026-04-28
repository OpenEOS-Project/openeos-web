'use client';

import type { FC, ReactNode, SVGProps } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Building07,
  Calendar,
  CoinsStacked01,
  CreditCard02,
  ShoppingBag01,
  Users01,
} from '@untitledui/icons';

import { cx } from '@/utils/cx';

const iconConfig = {
  'shopping-bag': { icon: ShoppingBag01, bg: 'bg-brand-50 dark:bg-brand-950', fg: 'text-brand-600 dark:text-brand-400' },
  'credit-card': { icon: CreditCard02, bg: 'bg-success-50 dark:bg-success-950', fg: 'text-success-600 dark:text-success-400' },
  calendar: { icon: Calendar, bg: 'bg-warning-50 dark:bg-warning-950', fg: 'text-warning-600 dark:text-warning-400' },
  users: { icon: Users01, bg: 'bg-blue-light-50 dark:bg-blue-light-950', fg: 'text-blue-light-600 dark:text-blue-light-400' },
  building: { icon: Building07, bg: 'bg-gray-50 dark:bg-gray-950', fg: 'text-gray-600 dark:text-gray-400' },
  coins: { icon: CoinsStacked01, bg: 'bg-success-50 dark:bg-success-950', fg: 'text-success-600 dark:text-success-400' },
} as const;

type IconName = keyof typeof iconConfig;

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
  const config = icon ? iconConfig[icon] : null;
  const Icon = config?.icon;

  return (
    <div className={cx(
      'group rounded-xl border border-secondary bg-primary p-5 shadow-xs transition-shadow hover:shadow-md',
      className
    )}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-tertiary">{title}</p>
        {Icon && config && (
          <div className={cx('flex size-10 items-center justify-center rounded-lg', config.bg)}>
            <Icon className={cx('size-5', config.fg)} />
          </div>
        )}
      </div>

      <p className="mt-2 text-display-xs font-semibold text-primary">{value}</p>

      {(change || subtitle) && (
        <div className="mt-3 flex items-center gap-2">
          {change && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                change.type === 'increase'
                  ? 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                  : 'bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'
              )}
            >
              {change.type === 'increase' ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {Math.abs(change.value)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-tertiary">{subtitle}</span>}
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
