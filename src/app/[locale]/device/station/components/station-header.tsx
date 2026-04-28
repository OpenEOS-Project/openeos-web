'use client';

import { useTranslations } from 'next-intl';
import { Wifi, WifiOff } from '@untitledui/icons';
import { Logo } from '@/components/foundations/logo/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { cx } from '@/utils/cx';

interface StationHeaderProps {
  stationName: string;
  stationColor?: string | null;
  isConnected: boolean;
  organizationName?: string;
  orderCount?: number;
  itemCount?: number;
}

export function StationHeader({ stationName, stationColor, isConnected, organizationName, orderCount, itemCount }: StationHeaderProps) {
  const t = useTranslations('device.station');

  return (
    <header className="flex h-14 items-center justify-between border-b border-secondary bg-primary px-4">
      <div className="flex items-center gap-3">
        <Logo width={100} height={25} />
        <div className="h-5 w-px bg-border-secondary" />
        {stationColor && (
          <div
            className="h-3 w-3 rounded-full ring-2 ring-white/50"
            style={{ backgroundColor: stationColor }}
          />
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">{stationName}</span>
          {organizationName && (
            <span className="text-xs text-tertiary">{organizationName}</span>
          )}
        </div>

        {/* Order & item count badges */}
        {orderCount != null && orderCount > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-400">
              {orderCount} {orderCount === 1 ? 'Bestellung' : 'Bestellungen'}
            </span>
            {itemCount != null && itemCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-tertiary">
                {itemCount} Artikel
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={cx(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1',
          isConnected ? 'bg-success-50 dark:bg-success-950' : 'bg-error-50 dark:bg-error-950'
        )}>
          {isConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-success-600 dark:text-success-400" />
              <span className="text-xs font-medium text-success-700 dark:text-success-400">{t('connected')}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-error-600 dark:text-error-400" />
              <span className="text-xs font-medium text-error-700 dark:text-error-400">{t('disconnected')}</span>
            </>
          )}
        </div>
        <div className="h-5 w-px bg-border-secondary" />
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
