'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { Device } from '@/types/device';

interface DeviceOverviewProps {
  device: Device;
  organizationId: string;
}

const statusBadgeClass: Record<string, string> = {
  verified: 'badge badge--success',
  pending: 'badge badge--warning',
  blocked: 'badge badge--error',
};

function formatRelativeTime(dateStr: string | null | undefined): string {
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
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="app-card" style={{ padding: '20px 24px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-.02em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginTop: 4, margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  );
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
      if (navigator.clipboard?.writeText) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label={t('devices.detail.stats.orders')} value={stats?.ordersCount ?? 0} />
        <StatCard label={t('devices.detail.stats.payments')} value={stats?.paymentsCount ?? 0} />
        <StatCard label={t('devices.detail.stats.revenue')} value={formatCurrency(stats?.revenueTotal ?? 0)} />
        <StatCard
          label={t('devices.detail.stats.status')}
          value={isOnline ? t('devices.online') : t('devices.offline')}
          sub={device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : undefined}
        />
      </div>

      {/* Device Details */}
      <div className="app-card">
        <div className="app-card__head">
          <div>
            <h2 className="app-card__title">{t('devices.detail.info.title')}</h2>
          </div>
        </div>
        <div className="app-card__body">
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 24px', margin: 0 }}>
            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.deviceId')}
              </dt>
              <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {device.id}
                </span>
                <button
                  onClick={copyDeviceId}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}
                  title="Copy ID"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.deviceType')}
              </dt>
              <dd style={{ margin: 0 }}>
                <span className="badge badge--neutral">{t(`devices.class.${device.type}`)}</span>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.status')}
              </dt>
              <dd style={{ margin: 0 }}>
                <span className={statusBadgeClass[device.status] ?? 'badge badge--neutral'}>
                  {t(`devices.status.${device.status}`)}
                </span>
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.createdAt')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {formatDateTime(device.createdAt)}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.verifiedAt')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {device.verifiedAt ? formatDateTime(device.verifiedAt) : t('devices.detail.info.notVerified')}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.userAgent')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.userAgent || '-'}
              </dd>
            </div>

            <div>
              <dt style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginBottom: 4 }}>
                {t('devices.detail.info.lastSeen')}
              </dt>
              <dd style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
