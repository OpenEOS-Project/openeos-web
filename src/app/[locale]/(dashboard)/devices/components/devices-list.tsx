'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { Megaphone, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import {
  AdminTable,
  CellMain,
  CellNone,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import { VerifyDeviceDialog } from './verify-device-dialog';
import { DeleteDeviceDialog } from './delete-device-dialog';
import { BroadcastDialog } from './broadcast-dialog';
import type { Device, DeviceStatus, DeviceClass } from '@/types/device';

import '@/styles/admin-table-wave2.css';

const statusBadgeClass: Record<DeviceStatus, string> = {
  pending: 'badge badge--warning',
  verified: 'badge badge--success',
  blocked: 'badge badge--error',
};

const classLabels: Partial<Record<DeviceClass, string>> = {
  pos: 'devices.class.pos',
  display: 'devices.class.display',
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
  const { formatDate } = useLocaleFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [verifyDevice, setVerifyDevice] = useState<Device | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);

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
          <Icon name="device" size={28} />
        </div>
        <h3 className="empty-state__title">{t('devices.noDevices')}</h3>
        <p className="empty-state__sub">{t('devices.noDevicesDescription')}</p>
      </div>
    );
  }

  const columns: DataColumn<Device>[] = [
    {
      id: 'name',
      header: t('devices.table.name'),
      mobile: 'title',
      cell: (device) => {
        const isOnline = onlineDeviceIds.has(device.id);
        return (
          <CellMain
            media={
              <span className="devices-list__icon">
                <Icon name="device" size={18} />
                <span
                  className={isOnline ? 'devices-list__dot is-online' : 'devices-list__dot'}
                  title={isOnline ? t('devices.online') : t('devices.offline')}
                />
              </span>
            }
            title={device.name}
            titleText={device.name}
            sub={device.userAgent || undefined}
            subText={device.userAgent || undefined}
            extra={isOnline ? <span className="devices-list__online">{t('devices.online')}</span> : undefined}
          />
        );
      },
    },
    {
      id: 'status',
      header: t('devices.table.status'),
      mobile: 'subtitle',
      cell: (device) => (
        <span className={statusBadgeClass[device.status]}>{t(`devices.status.${device.status}`)}</span>
      ),
    },
    {
      id: 'class',
      header: t('devices.table.class'),
      mobile: 'meta',
      cell: (device) => {
        const label = classLabels[device.type] ? t(classLabels[device.type] as string) : null;
        if (!label) return <CellNone />;
        /* "Anzeige" allein sagt nicht, was darauf läuft — die Küchenansicht
           und der Kundenwarenkorb sind zwei verschiedene Geräte im selben
           Gehäuse. */
        const mode =
          device.type === 'display'
            ? device.settings?.displayMode === 'station'
              ? t('devices.list.displayStation')
              : t('devices.list.displayCustomer')
            : null;
        return (
          <span className="devices-list__class">
            <CellText muted title={label}>{label}</CellText>
            {mode && <span className="devices-list__mode">{mode}</span>}
          </span>
        );
      },
    },
    {
      id: 'lastSeen',
      header: t('devices.table.lastSeen'),
      mobile: 'meta',
      priority: 2,
      className: 'admin-dt__date',
      cell: (device) => (device.lastSeenAt ? formatDate(device.lastSeenAt) : <CellNone />),
    },
  ];

  /* Freigeben steht bei wartenden Geräten vorn (wie bisher als Knopf in
     der Zeile), danach Bearbeiten und Sperren/Entsperren, Löschen zuletzt. */
  const actions = (device: Device): RowAction[] => [
    {
      id: 'verify',
      label: t('devices.actions.verify'),
      icon: <ShieldCheck />,
      primary: true,
      hidden: device.status !== 'pending',
      onClick: () => setVerifyDevice(device),
    },
    {
      id: 'edit',
      label: t('devices.actions.edit'),
      icon: 'edit',
      onClick: () => router.push(`/devices/${device.id}?tab=settings`),
    },
    {
      id: 'block',
      label: t('devices.actions.block'),
      icon: 'ban',
      hidden: device.status !== 'verified',
      disabled: blockMutation.isPending,
      onClick: () => blockMutation.mutate(device.id),
    },
    {
      id: 'unblock',
      label: t('devices.actions.unblock'),
      icon: 'check-circle',
      hidden: device.status !== 'blocked',
      disabled: unblockMutation.isPending,
      onClick: () => unblockMutation.mutate(device.id),
    },
    {
      id: 'delete',
      label: t('devices.actions.delete'),
      icon: 'trash',
      danger: true,
      onClick: () => setDeleteDevice(device),
    },
  ];

  return (
    <>
      <ListHead
        actions={
          <>
            <ListAction icon={<Megaphone />} label={t('devices.broadcast.title')} onClick={() => setShowBroadcast(true)} />
            <ListAction
              icon={<Icon name="refresh" className={isFetching ? 'admin-spin' : undefined} />}
              label={t('common.refresh')}
              onClick={() => refetch()}
              disabled={isFetching}
            />
          </>
        }
      >
        <ListCount>{t('devices.deviceCount', { count: devices.length })}</ListCount>
      </ListHead>

      {/* Ein Klick auf die Zeile öffnet das Gerät (vorher der Name als Knopf). */}
      <AdminTable
        caption={t('devices.title')}
        rows={devices}
        rowKey="id"
        columns={columns}
        actions={actions}
        onRowClick={(device) => router.push(`/devices/${device.id}`)}
        rowClassName={(device) => (device.status === 'blocked' ? 'admin-dt__row--muted' : undefined)}
      />

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
