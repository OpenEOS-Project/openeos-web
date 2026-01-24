'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth-store';
import type { Event } from '@/types';
import { ApiException } from '@/types/api';

const eventSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormModalProps {
  isOpen: boolean;
  event?: Event | null;
  onClose: () => void;
}

export function EventFormModal({ isOpen, event, onClose }: EventFormModalProps) {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const isEditing = !!event;
  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId || '';
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (event) {
      reset({
        name: event.name,
        description: event.description || '',
        startDate: event.startDate ? event.startDate.split('T')[0] : '',
        endDate: event.endDate ? event.endDate.split('T')[0] : '',
      });
    } else {
      reset({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
      });
    }
  }, [event, reset]);

  const onSubmit = async (data: EventFormData) => {
    if (!organizationId) return;
    setError(null);

    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({
          organizationId,
          id: event.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: data.startDate,
            endDate: data.endDate,
          },
        });
      } else {
        await createEvent.mutateAsync({
          organizationId,
          data: {
            name: data.name,
            description: data.description || undefined,
            startDate: data.startDate,
            endDate: data.endDate,
          },
        });
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError(tErrors('generic'));
      }
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {isEditing ? t('actions.edit') : t('create')}
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
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.name')}
                        placeholder={t('form.namePlaceholder')}
                        isRequired
                        isInvalid={!!errors.name}
                        hint={errors.name?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.description')}
                        placeholder={t('form.descriptionPlaceholder')}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="startDate"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={t('form.startDate')}
                          type="date"
                          isRequired
                          isInvalid={!!errors.startDate}
                          hint={errors.startDate?.message}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />

                    <Controller
                      name="endDate"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={t('form.endDate')}
                          type="date"
                          isRequired
                          isInvalid={!!errors.endDate}
                          hint={errors.endDate?.message}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                      {error}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button
                    type="button"
                    color="secondary"
                    onClick={handleClose}
                    isDisabled={isSubmitting}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                  >
                    {isEditing ? tCommon('save') : tCommon('create')}
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
