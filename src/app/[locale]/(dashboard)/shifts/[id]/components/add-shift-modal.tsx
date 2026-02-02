'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';

const schema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  startTime: z.string().min(1, 'Startzeit ist erforderlich'),
  endTime: z.string().min(1, 'Endzeit ist erforderlich'),
  requiredWorkers: z.number().min(1, 'Mindestens 1 Helfer erforderlich'),
});

type FormData = z.infer<typeof schema>;

interface AddShiftModalProps {
  open: boolean;
  jobId: string | null;
  planId: string;
  onClose: () => void;
}

export function AddShiftModal({ open, jobId, planId, onClose }: AddShiftModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: '',
      startTime: '10:00',
      endTime: '14:00',
      requiredWorkers: 2,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createShift(organizationId!, jobId!, {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        requiredWorkers: data.requiredWorkers,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      reset();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!jobId) return;
    setError(null);
    createMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
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
                  {t('shifts.editor.addShift')}
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
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 px-6 py-5">
                  {error && (
                    <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                      {error}
                    </div>
                  )}

                  <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="date"
                        label={t('shifts.editor.shiftDate')}
                        isRequired
                        isInvalid={!!errors.date}
                        hint={errors.date?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="startTime"
                      control={control}
                      render={({ field }) => (
                        <Input
                          type="time"
                          label={t('shifts.editor.shiftStartTime')}
                          isRequired
                          isInvalid={!!errors.startTime}
                          hint={errors.startTime?.message}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />

                    <Controller
                      name="endTime"
                      control={control}
                      render={({ field }) => (
                        <Input
                          type="time"
                          label={t('shifts.editor.shiftEndTime')}
                          isRequired
                          isInvalid={!!errors.endTime}
                          hint={errors.endTime?.message}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>

                  <Controller
                    name="requiredWorkers"
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="number"
                        label={t('shifts.editor.requiredWorkers')}
                        isRequired
                        isInvalid={!!errors.requiredWorkers}
                        hint={errors.requiredWorkers?.message}
                        value={String(field.value)}
                        onChange={(value) => field.onChange(parseInt(value) || 1)}
                        onBlur={field.onBlur}
                      />
                    )}
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
                    isDisabled={createMutation.isPending}
                    isLoading={createMutation.isPending}
                  >
                    {t('shifts.editor.addShift')}
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
