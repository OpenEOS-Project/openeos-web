'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag01,
  CreditCard02,
  CoinsStacked01,
  Copy01,
} from '@untitledui/icons';
import { Badge } from '@/components/ui/badges/badges';
import { devicesApi } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { Device } from '@/types/device';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

interface DeviceOverviewProps {
  device: Device;
  organizationId: string;
}

export function DeviceOverview({ device, organizationId }: DeviceOverviewProps) {
  const t = useTranslations();

  const { data: statsData } = useQuery({
    queryKey: ['device-stats', organizationId, device.id],
    queryFn: () => devicesApi.getStats(organizationId, device.id),
    enabled: !!organizationId && !!device.id,
  });

  const { data: onlineIdsData } = useQuery({
    queryKey: ['devices-online', organizationId],
    queryFn: () => devicesApi.getOnlineIds(organizationId),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });

  const stats = statsData?.data;
  const onlineDeviceIds = new Set(onlineIdsData?.data || []);
  const isOnline = onlineDeviceIds.has(device.id);

  const copyDeviceId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(device.id);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = device.id;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatRelativeTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const statusBadgeConfig: Record<string, { color: BadgeColors; label: string }> = {
    verified: { color: 'success', label: 'devices.status.verified' },
    pending: { color: 'gray', label: 'devices.status.pending' },
    blocked: { color: 'warning', label: 'devices.status.blocked' },
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-secondary bg-primary p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary">
              <ShoppingBag01 className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-sm text-tertiary">{t('devices.detail.stats.orders')}</p>
              <p className="text-2xl font-semibold text-primary">{stats?.ordersCount ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-secondary bg-primary p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary">
              <CreditCard02 className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-sm text-tertiary">{t('devices.detail.stats.payments')}</p>
              <p className="text-2xl font-semibold text-primary">{stats?.paymentsCount ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-secondary bg-primary p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary">
              <CoinsStacked01 className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-sm text-tertiary">{t('devices.detail.stats.revenue')}</p>
              <p className="text-2xl font-semibold text-primary">
                {formatCurrency(stats?.revenueTotal ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-secondary bg-primary p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary">
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  isOnline ? 'bg-success-primary' : 'bg-tertiary'
                }`}
              />
            </div>
            <div>
              <p className="text-sm text-tertiary">{t('devices.detail.stats.status')}</p>
              <p className="text-2xl font-semibold text-primary">
                {isOnline ? t('devices.online') : t('devices.offline')}
              </p>
              {device.lastSeenAt && (
                <p className="text-xs text-tertiary">{formatRelativeTime(device.lastSeenAt)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Device Details Card */}
      <div className="rounded-xl border border-secondary bg-primary p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">
          {t('devices.detail.info.title')}
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Device ID */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.deviceId')}</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-primary">
              <span className="truncate font-mono">{device.id}</span>
              <button
                onClick={copyDeviceId}
                className="flex-shrink-0 text-tertiary hover:text-primary transition-colors"
              >
                <Copy01 className="h-4 w-4" />
              </button>
            </dd>
          </div>

          {/* Device Type */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.deviceType')}</dt>
            <dd className="mt-1">
              <Badge color="gray" size="sm">
                {t(`devices.class.${device.type}`)}
              </Badge>
            </dd>
          </div>

          {/* Status */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.status')}</dt>
            <dd className="mt-1">
              <Badge color={statusBadgeConfig[device.status]?.color ?? 'gray'} size="sm">
                {t(statusBadgeConfig[device.status]?.label ?? 'devices.status.pending')}
              </Badge>
            </dd>
          </div>

          {/* Created At */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.createdAt')}</dt>
            <dd className="mt-1 text-sm font-medium text-primary">
              {formatDateTime(device.createdAt)}
            </dd>
          </div>

          {/* Verified At */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.verifiedAt')}</dt>
            <dd className="mt-1 text-sm font-medium text-primary">
              {device.verifiedAt
                ? formatDateTime(device.verifiedAt)
                : t('devices.detail.info.notVerified')}
            </dd>
          </div>

          {/* User Agent */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.userAgent')}</dt>
            <dd className="mt-1 text-sm font-medium text-primary truncate">
              {device.userAgent || '-'}
            </dd>
          </div>

          {/* Last Seen */}
          <div>
            <dt className="text-sm text-tertiary">{t('devices.detail.info.lastSeen')}</dt>
            <dd className="mt-1 text-sm font-medium text-primary">
              {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : '-'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
