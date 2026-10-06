'use client';

import type { ReactNode } from 'react';

import {
  Building,
  Calendar,
  Printer,
  Settings,
  ShoppingBag,
  TabletSmartphone,
  Tag,
  Users,
  Zap,
} from 'lucide-react';

import { cx } from '@/utils/cx';

const iconMap = {
  'shopping-bag': ShoppingBag,
  calendar: Calendar,
  building: Building,
  tag: Tag,
  tablet: TabletSmartphone,
  printer: Printer,
  zap: Zap,
  settings: Settings,
  users: Users,
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
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-25 dark:bg-brand-950 dark:ring-brand-900/30">
            <Icon className="size-5 text-brand-600 dark:text-brand-400" />
          </div>
        )}
        <h3 className="text-md font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm text-tertiary">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
