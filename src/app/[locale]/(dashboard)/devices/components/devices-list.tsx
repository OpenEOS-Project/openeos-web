'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tablet02,
  CheckCircle,
  XCircle,
  Clock,
  Trash01,
  ShieldOff,
  Shield01,
  RefreshCw01,
  Send01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import { VerifyDeviceDialog } from './verify-device-dialog';
import { DeleteDeviceDialog } from './delete-device-dialog';
import { BroadcastDialog } from './broadcast-dialog';
import type { Device, DeviceStatus, DeviceClass } from '@/types/device';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const statusConfig: Record<DeviceStatus, { color: BadgeColors; icon: typeof Clock }> = {
  pending: { color: 'gray', icon: Clock },
  verified: { color: 'success', icon: CheckCircle },
  blocked: { color: 'error', icon: XCircle },
};

const classLabels: Record<DeviceClass, string> = {
  pos: 'devices.class.pos',
  display_kitchen: 'devices.class.display_kitchen',
  display_delivery: 'devices.class.display_delivery',
  display_menu: 'devices.class.display_menu',
  display_pickup: 'devices.class.display_pickup',
  display_sales: 'devices.class.display_sales',
  admin: 'devices.class.admin',
};

export function DevicesList() {
  const t = useTranslations();
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
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: onlineIdsData } = useQuery({
    queryKey: ['devices-online', organizationId],
    queryFn: () => devicesApi.getOnlineIds(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const devices = devicesData?.data || [];
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

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon="tablet"
        title={t('devices.noDevices')}
        description={t('devices.noDevicesDescription')}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-tertiary">
          {t('devices.deviceCount', { count: devices.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            color="secondary"
            size="sm"
            onClick={() => setShowBroadcast(true)}
            iconLeading={Send01}
          >
            {t('devices.broadcast.title')}
          </Button>
          <Button
            color="secondary"
            size="sm"
            onClick={() => refetch()}
            isDisabled={isFetching}
            iconLeading={RefreshCw01}
            className={isFetching ? '[&_[data-icon]]:animate-spin' : ''}
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('devices.table.name')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('devices.table.status')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('devices.table.class')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('devices.table.lastSeen')}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">
                {t('devices.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary bg-primary">
            {devices.map((device) => {
              const config = statusConfig[device.status];
              const StatusIcon = config.icon;
              const isOnline = onlineDeviceIds.has(device.id);

              return (
                <tr key={device.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Tablet02 className="h-5 w-5 text-tertiary" />
                        {/* Online indicator */}
                        <span
                          className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-primary ${
                            isOnline ? 'bg-success-primary' : 'bg-tertiary'
                          }`}
                          title={isOnline ? t('devices.online') : t('devices.offline')}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-primary">{device.name}</p>
                          {isOnline && (
                            <span className="text-xs text-success-primary">{t('devices.online')}</span>
                          )}
                        </div>
                        {device.userAgent && (
                          <p className="max-w-xs truncate text-xs text-tertiary">
                            {device.userAgent}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={config.color} size="sm">
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {t(`devices.status.${device.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-secondary">
                      {device.deviceClass ? t(classLabels[device.deviceClass]) : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-tertiary">
                      {device.lastSeen ? formatDate(device.lastSeen) : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Dropdown.Root>
                      <Dropdown.DotsButton />
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu>
                          {device.status === 'pending' && (
                            <Dropdown.Item
                              onAction={() => setVerifyDevice(device)}
                              icon={CheckCircle}
                              label={t('devices.actions.verify')}
                            />
                          )}
                          {device.status === 'verified' && (
                            <Dropdown.Item
                              onAction={() => blockMutation.mutate(device.id)}
                              isDisabled={blockMutation.isPending}
                              icon={ShieldOff}
                              label={t('devices.actions.block')}
                            />
                          )}
                          {device.status === 'blocked' && (
                            <Dropdown.Item
                              onAction={() => unblockMutation.mutate(device.id)}
                              isDisabled={unblockMutation.isPending}
                              icon={Shield01}
                              label={t('devices.actions.unblock')}
                            />
                          )}
                          <Dropdown.Item
                            onAction={() => setDeleteDevice(device)}
                            className="text-error-primary"
                            icon={Trash01}
                            label={t('devices.actions.delete')}
                          />
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Verify Dialog */}
      {verifyDevice && (
        <VerifyDeviceDialog
          device={verifyDevice}
          onClose={() => setVerifyDevice(null)}
        />
      )}

      {/* Delete Dialog */}
      {deleteDevice && (
        <DeleteDeviceDialog
          device={deleteDevice}
          onClose={() => setDeleteDevice(null)}
        />
      )}

      {/* Broadcast Dialog */}
      {showBroadcast && (
        <BroadcastDialog
          onClose={() => setShowBroadcast(false)}
          onlineDeviceCount={onlineDeviceIds.size}
        />
      )}
    </>
  );
}
