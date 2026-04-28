'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Monitor01,
  Settings01,
  Printer,
  BarChart01,
  ShoppingCart01,
  Lock01,
  LockUnlocked01,
  Trash01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { Device, DeviceClass, DeviceStatus } from '@/types/device';
import type { BadgeColors } from '@/components/ui/badges/badge-types';
import { DeviceOverview } from './components/device-overview';
import { DeviceSettings } from './components/device-settings';
import { DevicePrinterConfig } from './components/device-printer-config';

const statusConfig: Record<DeviceStatus, { color: BadgeColors; label: string }> = {
  verified: { color: 'success', label: 'devices.status.verified' },
  pending: { color: 'gray', label: 'devices.status.pending' },
  blocked: { color: 'warning', label: 'devices.status.blocked' },
};

const typeIcons: Record<DeviceClass, FC<{ className?: string }>> = {
  pos: ShoppingCart01,
  display: Monitor01,
  admin: Settings01,
  printer_agent: Printer,
};

export default function DeviceDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const deviceId = params.id as string;

  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
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

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-6">
        <p className="text-secondary">{t('errors.notFound')}</p>
      </div>
    );
  }

  const statusCfg = statusConfig[device.status];
  const DeviceIcon = typeIcons[device.type] || Monitor01;

  return (
    <div className="-m-4 lg:-m-6 flex h-[calc(100vh-4rem)] flex-col bg-primary">
      {/* Header */}
      <div className="border-b border-secondary px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {/* Left side: Back button, info, badges */}
          <div className="flex items-center gap-4 min-w-0">
            <Button
              color="tertiary"
              size="sm"
              iconLeading={ArrowLeft}
              onClick={() => router.push('/devices')}
            />
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
                <DeviceIcon className="h-5 w-5 text-brand-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-primary">{device.name}</h1>
                <div className="flex items-center gap-2 text-sm text-tertiary">
                  <span>{t(`devices.class.${device.type}`)}</span>
                </div>
              </div>
            </div>
            {/* Online badge */}
            <Badge color={isOnline ? 'success' : 'gray'} size="md" className="flex-shrink-0">
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                  isOnline ? 'bg-success-primary' : 'bg-tertiary'
                }`}
              />
              {isOnline ? t('devices.online') : t('devices.offline')}
            </Badge>
            {/* Status badge */}
            <Badge color={statusCfg.color} size="md" className="flex-shrink-0">
              {t(statusCfg.label)}
            </Badge>
          </div>

          {/* Right side: Actions */}
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {device.status === 'verified' && (
              <Button
                color="secondary"
                size="sm"
                iconLeading={Lock01}
                onClick={() => blockMutation.mutate()}
                isLoading={blockMutation.isPending}
              >
                {t('devices.actions.block')}
              </Button>
            )}
            {device.status === 'blocked' && (
              <Button
                color="secondary"
                size="sm"
                iconLeading={LockUnlocked01}
                onClick={() => unblockMutation.mutate()}
                isLoading={unblockMutation.isPending}
              >
                {t('devices.actions.unblock')}
              </Button>
            )}
            <Button
              color="secondary"
              size="sm"
              iconLeading={Trash01}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t('devices.actions.delete')}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="flex-1 flex flex-col"
      >
        <TabList type="underline" className="px-6 pt-2">
          <Tab id="overview" className="flex items-center gap-2">
            <BarChart01 className="h-4 w-4" />
            {t('devices.detail.tabs.overview')}
          </Tab>
          <Tab id="settings" className="flex items-center gap-2">
            <Settings01 className="h-4 w-4" />
            {t('devices.detail.tabs.settings')}
          </Tab>
          {device.type !== 'display' && (
            <Tab id="printer" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              {t('devices.detail.tabs.printer')}
            </Tab>
          )}
        </TabList>

        <TabPanel id="overview" className="flex-1 overflow-auto p-6">
          <DeviceOverview device={device} organizationId={organizationId!} />
        </TabPanel>

        <TabPanel id="settings" className="flex-1 overflow-auto p-6">
          <DeviceSettings device={device} organizationId={organizationId!} />
        </TabPanel>

        {device.type !== 'display' && (
          <TabPanel id="printer" className="flex-1 overflow-auto p-6">
            <DevicePrinterConfig device={device} organizationId={organizationId!} />
          </TabPanel>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <DialogModal
          isOpen
          onClose={() => setShowDeleteConfirm(false)}
          title={t('devices.deleteDialog.title')}
          description={t('devices.deleteDialog.description')}
        >
          <div className="px-6 py-4">
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="font-medium text-primary">{device.name}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
            <Button type="button" color="secondary" onClick={() => setShowDeleteConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '...' : t('common.delete')}
            </Button>
          </div>
        </DialogModal>
      )}
    </div>
  );
}
