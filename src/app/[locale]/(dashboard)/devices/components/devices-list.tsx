'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import { VerifyDeviceDialog } from './verify-device-dialog';
import { DeleteDeviceDialog } from './delete-device-dialog';
import { BroadcastDialog } from './broadcast-dialog';
import type { Device, DeviceStatus, DeviceClass } from '@/types/device';

const statusBadgeClass: Record<DeviceStatus, string> = {
  pending: 'badge badge--warning',
  verified: 'badge badge--success',
  blocked: 'badge badge--error',
};

const classLabels: Partial<Record<DeviceClass, string>> = {
  pos: 'devices.class.pos',
  admin: 'devices.class.admin',
  printer_agent: 'devices.class.printer_agent',
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

export function DevicesList() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [verifyDevice, setVerifyDevice] = useState<Device | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPos(null);
  };

  useEffect(() => {
    if (!openMenuId) return;
    const handleClose = () => closeMenu();
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [openMenuId]);

  const toggleMenu = (deviceId: string, button: HTMLButtonElement) => {
    if (openMenuId === deviceId) {
      closeMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    const menuHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + 16;
    const top = openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
    const right = Math.max(8, window.innerWidth - rect.right);
    setMenuPos({ top, right });
    setOpenMenuId(deviceId);
  };

  const { data: devicesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['devices', organizationId],
    queryFn: () => devicesApi.list(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });

  const { data: onlineIdsData } = useQuery({
    queryKey: ['devices-online', organizationId],
    queryFn: () => devicesApi.getOnlineIds(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 5000,
  });

  // Printer-agent devices are managed under "Drucker" and shouldn't clutter
  // the general device list — but other places (printer ↔ agent binding) still
  // need to see them, so we filter only here in the dashboard view.
  const devices = (devicesData?.data || []).filter((d) => d.type !== 'printer_agent');
  const onlineDeviceIds = new Set(onlineIdsData?.data || []);

  const blockMutation = useMutation({
    mutationFn: (deviceId: string) => devicesApi.block(organizationId!, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (deviceId: string) => devicesApi.unblock(organizationId!, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
    },
  });

  if (isLoading) return <Spinner />;

  if (devices.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18.01" />
          </svg>
        </div>
        <h3 className="empty-state__title">{t('devices.noDevices')}</h3>
        <p className="empty-state__sub">{t('devices.noDevicesDescription')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="app-card__head">
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>
            {t('devices.deviceCount', { count: devices.length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={() => setShowBroadcast(true)}>
            {t('devices.broadcast.title')}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? '...' : t('common.refresh')}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('devices.table.name')}</th>
              <th>{t('devices.table.status')}</th>
              <th>{t('devices.table.class')}</th>
              <th>{t('devices.table.lastSeen')}</th>
              <th className="text-right">{t('devices.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const isOnline = onlineDeviceIds.has(device.id);
              return (
                <tr key={device.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'color-mix(in oklab, var(--ink) 6%, transparent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                            <rect x="5" y="2" width="14" height="20" rx="2" />
                            <line x1="12" y1="18" x2="12" y2="18.01" />
                          </svg>
                        </div>
                        <span style={{
                          position: 'absolute', top: -3, right: -3,
                          width: 10, height: 10, borderRadius: '50%',
                          background: isOnline ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 30%, transparent)',
                          border: '2px solid var(--paper)',
                        }} title={isOnline ? t('devices.online') : t('devices.offline')} />
                      </div>
                      <div>
                        <button
                          onClick={() => router.push(`/devices/${device.id}`)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            fontWeight: 600, color: 'var(--ink)', fontSize: 14,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--green-ink)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                        >
                          {device.name}
                        </button>
                        {isOnline && (
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--green-ink)' }}>
                            {t('devices.online')}
                          </span>
                        )}
                        {device.userAgent && (
                          <span style={{
                            display: 'block', fontSize: 11,
                            color: 'color-mix(in oklab, var(--ink) 45%, transparent)',
                            maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {device.userAgent}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={statusBadgeClass[device.status]}>
                      {t(`devices.status.${device.status}`)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                      {classLabels[device.type] ? t(classLabels[device.type] as string) : '-'}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
                      {device.lastSeenAt ? formatDate(device.lastSeenAt) : '-'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {device.status === 'pending' && (
                        <button
                          className="btn btn--primary"
                          style={{ padding: '4px 12px', fontSize: 13 }}
                          onClick={() => setVerifyDevice(device)}
                        >
                          {t('devices.actions.verify')}
                        </button>
                      )}
                      <button
                        className="btn btn--ghost"
                        style={{ padding: '4px 10px', fontSize: 13 }}
                        onClick={(e) => toggleMenu(device.id, e.currentTarget)}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === device.id}
                      >
                        ···
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(() => {
        if (!openMenuId || !menuPos) return null;
        const device = devices.find((d) => d.id === openMenuId);
        if (!device) return null;
        const itemStyle: React.CSSProperties = {
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 14px',
          fontSize: 13,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink)',
        };
        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 200 }}
              onClick={closeMenu}
            />
            <div
              role="menu"
              style={{
                position: 'fixed',
                top: menuPos.top,
                right: menuPos.right,
                zIndex: 210,
                background: 'var(--paper)',
                border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                borderRadius: 10,
                boxShadow: '0 8px 24px color-mix(in oklab, var(--ink) 12%, transparent)',
                minWidth: 180,
                padding: '4px 0',
              }}
            >
              <button
                style={itemStyle}
                onClick={() => { closeMenu(); router.push(`/devices/${device.id}?tab=settings`); }}
              >
                {t('devices.actions.edit')}
              </button>
              {device.status === 'pending' && (
                <button
                  style={itemStyle}
                  onClick={() => { closeMenu(); setVerifyDevice(device); }}
                >
                  {t('devices.actions.verify')}
                </button>
              )}
              {device.status === 'verified' && (
                <button
                  style={itemStyle}
                  onClick={() => { closeMenu(); blockMutation.mutate(device.id); }}
                  disabled={blockMutation.isPending}
                >
                  {t('devices.actions.block')}
                </button>
              )}
              {device.status === 'blocked' && (
                <button
                  style={itemStyle}
                  onClick={() => { closeMenu(); unblockMutation.mutate(device.id); }}
                  disabled={unblockMutation.isPending}
                >
                  {t('devices.actions.unblock')}
                </button>
              )}
              <div style={{ height: 1, background: 'color-mix(in oklab, var(--ink) 8%, transparent)', margin: '4px 0' }} />
              <button
                style={{ ...itemStyle, color: 'var(--danger)' }}
                onClick={() => { closeMenu(); setDeleteDevice(device); }}
              >
                {t('devices.actions.delete')}
              </button>
            </div>
          </>
        );
      })()}

      {verifyDevice && (
        <VerifyDeviceDialog device={verifyDevice} onClose={() => setVerifyDevice(null)} />
      )}
      {deleteDevice && (
        <DeleteDeviceDialog device={deleteDevice} onClose={() => setDeleteDevice(null)} />
      )}
      {showBroadcast && (
        <BroadcastDialog onClose={() => setShowBroadcast(false)} onlineDeviceCount={onlineDeviceIds.size} />
      )}
    </>
  );
}
