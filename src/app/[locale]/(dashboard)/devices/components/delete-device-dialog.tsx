'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { Device } from '@/types/device';

interface DeleteDeviceDialogProps {
  device: Device;
  onClose: () => void;
}

export function DeleteDeviceDialog({ device, onClose }: DeleteDeviceDialogProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const deleteMutation = useMutation({
    mutationFn: () => devicesApi.delete(organizationId!, device.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      onClose();
    },
  });

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={t('deleteDialog.title')}
      description={t('deleteDialog.description')}
    >
      <div className="px-6 py-4">
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="font-medium text-primary">{device.name}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          {tCommon('cancel')}
        </Button>
        <Button
          color="primary-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? '...' : tCommon('delete')}
        </Button>
      </div>
    </DialogModal>
  );
}
