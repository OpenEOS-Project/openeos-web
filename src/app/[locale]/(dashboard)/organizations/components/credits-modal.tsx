'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { adminApi } from '@/lib/api-client';
import type { Organization } from '@/types/organization';

interface CreditsModalProps {
  isOpen: boolean;
  organization: Organization | null;
  onClose: () => void;
}

interface CreditsFormData {
  amount: number;
  reason: string;
}

export function CreditsModal({ isOpen, organization, onClose }: CreditsModalProps) {
  const t = useTranslations('organizations');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreditsFormData>({
    defaultValues: {
      amount: 0,
      reason: '',
    },
  });

  const adjustCreditsMutation = useMutation({
    mutationFn: (data: CreditsFormData) =>
      adminApi.adjustCredits(organization!.id, {
        amount: data.amount,
        reason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      handleClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Fehler beim Anpassen der Credits');
    },
  });

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  const onSubmit = (data: CreditsFormData) => {
    if (!organization) return;
    setError(null);
    adjustCreditsMutation.mutate(data);
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('credits.title')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 px-6 py-5">
                  {/* Current Credits Display */}
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-tertiary">{t('credits.current')}</p>
                    <p className="text-2xl font-bold text-primary">{organization?.eventCredits ?? 0}</p>
                  </div>

                  <Controller
                    name="amount"
                    control={control}
                    rules={{
                      required: true,
                      validate: (value) => value !== 0 || 'Amount cannot be 0',
                    }}
                    render={({ field }) => (
                      <Input
                        type="number"
                        label={t('credits.amount')}
                        placeholder={t('credits.amountPlaceholder')}
                        value={field.value.toString()}
                        onChange={(value) => field.onChange(parseInt(value) || 0)}
                        isInvalid={!!errors.amount}
                        hint="Positive Werte fuegen Credits hinzu, negative entfernen welche."
                      />
                    )}
                  />

                  <Controller
                    name="reason"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Input
                        label={t('credits.reason')}
                        placeholder={t('credits.reasonPlaceholder')}
                        value={field.value}
                        onChange={field.onChange}
                        isInvalid={!!errors.reason}
                      />
                    )}
                  />

                  {/* Preview */}
                  {organization && (
                    <div className="rounded-lg border border-secondary p-3">
                      <p className="text-sm text-tertiary">Neuer Stand nach Anpassung:</p>
                      <p className="text-lg font-semibold text-primary">
                        {(organization.eventCredits ?? 0) + (control._formValues.amount || 0)} Credits
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                      {error}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button type="button" color="secondary" onClick={handleClose}>
                    {tCommon('cancel')}
                  </Button>
                  <Button type="submit" isLoading={adjustCreditsMutation.isPending}>
                    {t('credits.adjust')}
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
