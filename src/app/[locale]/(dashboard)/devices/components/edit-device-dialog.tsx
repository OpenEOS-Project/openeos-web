'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loading02 } from '@untitledui/icons';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi, sumupApi } from '@/lib/api-client';
import type { Device, DeviceClass } from '@/types/device';

interface EditDeviceDialogProps {
  device: Device;
  onClose: () => void;
}

const DEVICE_TYPE_VALUES: DeviceClass[] = [
  'pos',
  'display_kitchen',
  'display_delivery',
  'display_menu',
  'display_pickup',
  'display_sales',
  'display_customer',
  'admin',
];

export function EditDeviceDialog({ device, onClose }: EditDeviceDialogProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const sumupConfigured = !!currentOrganization?.organization?.settings?.sumup?.merchantCode;
  const isPosDevice = device.deviceClass === 'pos';

  const [name, setName] = useState(device.name);
  const [deviceType, setDeviceType] = useState<DeviceClass>(device.deviceClass);
  const [sumupReaderId, setSumupReaderId] = useState(device.settings?.sumupReaderId || '');
  const [error, setError] = useState<string | null>(null);

  // Load SumUp readers for POS devices
  const readersQuery = useQuery({
    queryKey: ['sumup-readers', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const response = await sumupApi.listReaders(organizationId);
      return response.data || [];
    },
    enabled: !!organizationId && isPosDevice && sumupConfigured,
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const updateData: Record<string, unknown> = {};
      if (name !== device.name) updateData.name = name;
      if (deviceType !== device.deviceClass) updateData.type = deviceType;

      // Include settings with sumupReaderId for POS devices
      if (isPosDevice && sumupReaderId !== (device.settings?.sumupReaderId || '')) {
        updateData.settings = {
          ...device.settings,
          sumupReaderId: sumupReaderId || undefined,
        };
      }

      return devicesApi.update(organizationId!, device.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      onClose();
    },
    onError: () => {
      setError(t('edit.failed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('edit.nameRequired'));
      return;
    }
    setError(null);
    updateMutation.mutate();
  };

  const hasChanges =
    name !== device.name ||
    deviceType !== device.deviceClass ||
    (isPosDevice && sumupReaderId !== (device.settings?.sumupReaderId || ''));

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={t('edit.title')}
      description={t('edit.description')}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 px-6 py-4">
          {/* Device Name */}
          <div className="space-y-1.5">
            <Label htmlFor="deviceName">{t('edit.name')}</Label>
            <Input
              id="deviceName"
              value={name}
              onChange={setName}
              placeholder={t('edit.namePlaceholder')}
              autoFocus
            />
          </div>

          {/* Device Type */}
          <div className="space-y-1.5">
            <Label htmlFor="deviceType">{t('edit.type')}</Label>
            <Select
              selectedKey={deviceType}
              onSelectionChange={(value) => setDeviceType(value as DeviceClass)}
            >
              {DEVICE_TYPE_VALUES.map((type) => (
                <Select.Item key={type} id={type}>
                  {t(`class.${type}`)}
                </Select.Item>
              ))}
            </Select>
            {deviceType !== device.deviceClass && (
              <p className="text-xs text-warning-primary">
                {t('edit.typeChangeWarning')}
              </p>
            )}
          </div>

          {/* SumUp Reader (only for POS devices with SumUp configured) */}
          {isPosDevice && sumupConfigured && (
            <div className="space-y-1.5">
              <Label htmlFor="sumupReader">{t('edit.sumupReader')}</Label>
              <Select
                selectedKey={sumupReaderId}
                onSelectionChange={(value) => setSumupReaderId(value as string)}
              >
                <Select.Item key="" id="">
                  {t('edit.sumupReaderNone')}
                </Select.Item>
                {(readersQuery.data || []).map((reader) => (
                  <Select.Item key={reader.id} id={reader.id}>
                    {reader.name}
                  </Select.Item>
                ))}
              </Select>
            </div>
          )}

          {isPosDevice && !sumupConfigured && (
            <p className="text-xs text-tertiary">{t('edit.sumupNotConfigured')}</p>
          )}

          {error && (
            <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
          <Button type="button" color="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loading02 className="h-5 w-5 animate-spin" />
            ) : (
              tCommon('save')
            )}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
