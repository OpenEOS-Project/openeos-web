'use client';

import type { ReactNode } from 'react';

import {
  Building07,
  Calendar,
  Printer,
  Settings01,
  ShoppingBag01,
  Tablet02,
  Tag01,
  Users01,
  Zap,
} from '@untitledui/icons';

import { cx } from '@/utils/cx';

const iconMap = {
  'shopping-bag': ShoppingBag01,
  calendar: Calendar,
  building: Building07,
  tag: Tag01,
  tablet: Tablet02,
  printer: Printer,
  zap: Zap,
  settings: Settings01,
  users: Users01,
} as const;

type IconName = keyof typeof iconMap;

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const Icon = icon ? iconMap[icon] : null;

  return (
    <div className={cx('flex items-center justify-center py-12 text-center', className)}>
      <div className="max-w-sm">
        {Icon && (
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Icon className="size-6 text-fg-quaternary" />
          </div>
        )}
        <h3 className="text-md font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm text-tertiary">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
