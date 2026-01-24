'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Textarea } from '@/components/ui/textarea/textarea';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { ShiftRegistration } from '@/types/shift';

interface SendMessageModalProps {
  open: boolean;
  registration: ShiftRegistration | null;
  onClose: () => void;
}

export function SendMessageModal({ open, registration, onClose }: SendMessageModalProps) {
  const t = useTranslations();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () =>
      shiftsApi.sendMessage(organizationId!, registration!.id, message),
    onSuccess: () => {
      setMessage('');
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const handleClose = () => {
    setMessage('');
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !registration) return;
    setError(null);
    sendMutation.mutate();
  };

  return (
    <DialogTrigger isOpen={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('shifts.registration.sendMessage')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 px-6 py-5">
                  {error && (
                    <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                      {error}
                    </div>
                  )}

                  {registration && (
                    <p className="text-sm text-secondary">
                      Nachricht an: <strong>{registration.name}</strong> ({registration.email})
                    </p>
                  )}

                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('shifts.registration.messagePlaceholder')}
                    rows={4}
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button type="button" color="secondary" onClick={handleClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    isDisabled={!message.trim() || sendMutation.isPending}
                    isLoading={sendMutation.isPending}
                  >
                    {t('shifts.registration.sendMessage')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
