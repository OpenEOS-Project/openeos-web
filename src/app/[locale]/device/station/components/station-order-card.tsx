'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { cx } from '@/utils/cx';

interface OrderInfo {
  id: string;
  orderNumber: string;
  dailyNumber: number;
  tableNumber: string | null;
  customerName: string | null;
  priority: string;
  createdAt: string;
}

interface OrderItemInfo {
  id: string;
  productName: string;
  categoryName: string;
  quantity: number;
  status: string;
  notes: string | null;
  kitchenNotes: string | null;
  options: any;
  createdAt: string;
}

interface StationOrderCardProps {
  order: OrderInfo;
  items: OrderItemInfo[];
  onItemReady: (itemId: string) => void;
  isMarkingReady: boolean;
  isNew?: boolean;
  variant?: 'service' | 'pickup';
}

function formatElapsed(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getTimerColor(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = diff / 60000;
  if (minutes > 15) return 'text-error-primary';
  if (minutes > 5) return 'text-warning-primary';
  return 'text-success-primary';
}

export function StationOrderCard({ order, items, onItemReady, isMarkingReady, isNew, variant }: StationOrderCardProps) {
  const t = useTranslations('device.station');
  const [elapsed, setElapsed] = useState(formatElapsed(order.createdAt));
  const [timerColor, setTimerColor] = useState(getTimerColor(order.createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(order.createdAt));
      setTimerColor(getTimerColor(order.createdAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isRush = order.priority === 'rush';
  const isHigh = order.priority === 'high';

  const variantStyles = variant === 'service'
    ? 'border-l-4 border-l-blue-light-500'
    : variant === 'pickup'
    ? 'border-l-4 border-l-success-500'
    : '';

  return (
    <div
      className={cx(
        'rounded-xl border bg-primary shadow-sm overflow-hidden transition-all duration-300',
        isRush ? 'border-error-solid border-2' : isHigh ? 'border-warning-solid border-2' : 'border-secondary',
        variantStyles,
        isNew && 'animate-pulse ring-2 ring-brand-500 ring-offset-2 ring-offset-bg-secondary'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">#{order.dailyNumber}</span>
            {variant === 'pickup' && (
              <span className="rounded-full bg-success-secondary px-2 py-0.5 text-xs font-semibold text-success-primary">
                ABHOLUNG
              </span>
            )}
            {isRush && (
              <span className="rounded-full bg-error-secondary px-2 py-0.5 text-xs font-semibold text-error-primary">
                RUSH
              </span>
            )}
            {isHigh && (
              <span className="rounded-full bg-warning-secondary px-2 py-0.5 text-xs font-semibold text-warning-primary">
                HIGH
              </span>
            )}
          </div>
          {order.tableNumber && (
            <p className="text-sm text-tertiary">{t('table')} {order.tableNumber}</p>
          )}
          {order.customerName && (
            <p className="text-sm text-tertiary">{order.customerName}</p>
          )}
        </div>
        <span className={cx('text-lg font-mono font-semibold', timerColor)}>
          {elapsed}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-secondary">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">{item.quantity}x</span>
                <span className="text-primary truncate">{item.productName}</span>
              </div>
              {item.notes && (
                <p className="text-xs text-tertiary mt-0.5">{item.notes}</p>
              )}
              {item.kitchenNotes && (
                <p className="text-xs font-medium text-warning-primary mt-0.5">{item.kitchenNotes}</p>
              )}
            </div>
            {item.status === 'pending' || item.status === 'in_progress' ? (
              <Button
                size="sm"
                color="primary"
                className="ml-3 min-h-[48px] min-w-[80px]"
                onClick={() => onItemReady(item.id)}
                isDisabled={isMarkingReady}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {t('ready')}
              </Button>
            ) : (
              <span className="ml-3 text-xs font-medium text-success-primary">{t('ready')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
