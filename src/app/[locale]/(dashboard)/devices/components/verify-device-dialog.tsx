'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { Device } from '@/types/device';

interface VerifyDeviceDialogProps {
  device: Device;
  onClose: () => void;
}

export function VerifyDeviceDialog({ device, onClose }: VerifyDeviceDialogProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: () => devicesApi.verify(organizationId!, device.id, { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', organizationId] });
      onClose();
    },
    onError: () => {
      setError(t('verifyDialog.invalidCode'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    verifyMutation.mutate();
  };

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={t('verifyDialog.title')}
      description={t('verifyDialog.description')}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg bg-secondary p-4 text-center">
            <p className="text-sm text-tertiary">{device.name}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code">{t('verifyDialog.code')}</Label>
            <Input
              id="code"
              value={code}
              onChange={setCode}
              placeholder={t('verifyDialog.codePlaceholder')}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-error-primary">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
          <Button type="button" color="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!code.trim() || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? '...' : t('verifyDialog.submit')}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
