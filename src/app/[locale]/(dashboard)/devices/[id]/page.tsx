'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { Device, DeviceClass, DeviceStatus } from '@/types/device';
import { DeviceOverview } from './components/device-overview';
import { DeviceSettings } from './components/device-settings';
import { DevicePrinterConfig } from './components/device-printer-config';

const statusBadgeClass: Record<DeviceStatus, string> = {
  verified: 'badge badge--success',
  pending: 'badge badge--warning',
  blocked: 'badge badge--error',
};

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--green-ink)', borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const TABS = ['overview', 'settings', 'printer'] as const;
type TabId = typeof TABS[number];

export default function DeviceDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const deviceId = params.id as string;

  const initialTab = (searchParams.get('tab') || 'overview') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: deviceData, isLoading } = useQuery({
    queryKey: ['device', organizationId, deviceId],
    queryFn: () => devicesApi.get(organizationId!, deviceId),
    enabled: !!organizationId && !!deviceId,
  });

  const { data: onlineIdsData } = useQuery({
    queryKey: ['devices-online', organizationId],
    queryFn: () => devicesApi.getOnlineIds(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });

  const device = deviceData?.data;
  const onlineDeviceIds = new Set(onlineIdsData?.data || []);
  const isOnline = device ? onlineDeviceIds.has(device.id) : false;

  const blockMutation = useMutation({
    mutationFn: () => devicesApi.block(organizationId!, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => devicesApi.unblock(organizationId!, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', organizationId, deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => devicesApi.delete(organizationId!, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      router.push('/devices');
    },
  });

  if (isLoading) return <Spinner />;

  if (!device) {
    return (
      <div className="app-card">
        <p style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontSize: 14 }}>
          {t('errors.notFound')}
        </p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: 'overview', label: t('devices.detail.tabs.overview') },
    { id: 'settings', label: t('devices.detail.tabs.settings') },
    { id: 'printer', label: t('devices.detail.tabs.printer'), hidden: device.type === 'display' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div className="app-page-head" style={{ marginBottom: 0 }}>
        <div className="app-page-head__copy" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn--ghost"
            style={{ padding: '6px 10px', flexShrink: 0 }}
            onClick={() => router.push('/devices')}
            aria-label="Back"
          >
            ←
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in oklab, var(--green-ink) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="1.75">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18.01" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="app-page-head__title" style={{ margin: 0 }}>{device.name}</h1>
              <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', margin: 0 }}>
                {t(`devices.class.${device.type}`)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={isOnline ? 'badge badge--success' : 'badge badge--neutral'}>
              {isOnline ? t('devices.online') : t('devices.offline')}
            </span>
            <span className={statusBadgeClass[device.status]}>
              {t(`devices.status.${device.status}`)}
            </span>
          </div>
        </div>

        <div className="app-page-head__actions">
          {device.status === 'verified' && (
            <button
              className="btn btn--ghost"
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
            >
              {t('devices.actions.block')}
            </button>
          )}
          {device.status === 'blocked' && (
            <button
              className="btn btn--ghost"
              onClick={() => unblockMutation.mutate()}
              disabled={unblockMutation.isPending}
            >
              {t('devices.actions.unblock')}
            </button>
          )}
          <button
            className="btn btn--ghost"
            style={{ color: '#d24545' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            {t('devices.actions.delete')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
        display: 'flex', gap: 0, marginBottom: 24,
      }}>
        {tabs.filter(tab => !tab.hidden).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--green-ink)'
                : '2px solid transparent',
              color: activeTab === tab.id
                ? 'var(--green-ink)'
                : 'color-mix(in oklab, var(--ink) 55%, transparent)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'overview' && (
        <DeviceOverview device={device} organizationId={organizationId!} />
      )}
      {activeTab === 'settings' && (
        <DeviceSettings device={device} organizationId={organizationId!} />
      )}
      {activeTab === 'printer' && device.type !== 'display' && (
        <DevicePrinterConfig device={device} organizationId={organizationId!} />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="modal__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>{t('devices.deleteDialog.title')}</h2>
              <button
                className="modal__close"
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 14, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 16 }}>
                {t('devices.deleteDialog.description')}
              </p>
              <div style={{
                background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                borderRadius: 10, padding: 12, textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{device.name}</p>
              </div>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: '#d24545', borderColor: '#d24545' }}
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '...' : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
