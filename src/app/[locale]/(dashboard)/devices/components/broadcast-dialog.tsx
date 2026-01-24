'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from '@untitledui/icons';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';

type MessageType = 'info' | 'warning' | 'success' | 'error';

interface BroadcastDialogProps {
  onClose: () => void;
  onlineDeviceCount: number;
}

const typeIcons: Record<MessageType, typeof AlertCircle> = {
  info: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
};

const typeColors: Record<MessageType, string> = {
  info: 'bg-brand-primary/10 text-brand-primary border-brand-primary',
  warning: 'bg-warning-primary/10 text-warning-primary border-warning-primary',
  success: 'bg-success-primary/10 text-success-primary border-success-primary',
  error: 'bg-error-primary/10 text-error-primary border-error-primary',
};

export function BroadcastDialog({ onClose, onlineDeviceCount }: BroadcastDialogProps) {
  const t = useTranslations('devices.broadcast');
  const tCommon = useTranslations('common');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');

  const broadcastMutation = useMutation({
    mutationFn: () =>
      organizationsApi.broadcast(organizationId!, {
        message,
        type: messageType,
      }),
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    broadcastMutation.mutate();
  };

  const types: MessageType[] = ['info', 'warning', 'success', 'error'];

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={t('title')}
      description={t('description')}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 px-6 py-4">
          {onlineDeviceCount === 0 && (
            <div className="rounded-lg bg-warning-primary/10 p-3 text-center">
              <p className="text-sm text-warning-primary">{t('noDevicesOnline')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="message">{t('message')}</Label>
            <Input
              id="message"
              value={message}
              onChange={setMessage}
              placeholder={t('messagePlaceholder')}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('messageType')}</Label>
            <div className="flex gap-2">
              {types.map((type) => {
                const Icon = typeIcons[type];
                const isSelected = messageType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMessageType(type)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? typeColors[type]
                        : 'border-secondary bg-primary text-secondary hover:bg-secondary'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t(`types.${type}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
          <Button type="button" color="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!message.trim() || broadcastMutation.isPending || onlineDeviceCount === 0}
          >
            {broadcastMutation.isPending ? t('sending') : t('send')}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
