'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Calendar } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea/textarea';
import { Select } from '@/components/ui/select/select';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi, eventsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan } from '@/types/shift';

const schema = z.object({
  eventId: z.string().optional(),
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateShiftPlanModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: ShiftPlan) => void;
}

export function CreateShiftPlanModal({ open, onClose, onCreated }: CreateShiftPlanModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId && open,
  });

  const events = eventsData?.data || [];
  const activeEvents = events.filter((e) => e.status === 'draft' || e.status === 'active');

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventId: '',
      name: '',
      description: '',
    },
  });

  const selectedEventId = watch('eventId');
  const currentName = watch('name');

  const handleEventChange = (eventId: string | null) => {
    setValue('eventId', eventId || '');
    if (eventId && !currentName) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        setValue('name', `${t('shifts.helperPlan')} ${event.name}`);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createPlan(organizationId!, {
        name: data.name,
        description: data.description || undefined,
        eventId: data.eventId || undefined,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
      reset();
      onCreated(response.data);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const onSubmit = (data: FormData) => {
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
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('shifts.createPlan')}
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

                  {activeEvents.length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-primary">
                        {t('shifts.form.event')}
                      </label>
                      <Select
                        placeholder={t('shifts.form.eventPlaceholder')}
                        selectedKey={selectedEventId || null}
                        onSelectionChange={(key) => handleEventChange(key as string | null)}
                      >
                        {activeEvents.map((event) => (
                          <Select.Item key={event.id} id={event.id} icon={Calendar}>
                            {event.name} ({formatDate(event.startDate)})
                          </Select.Item>
                        ))}
                      </Select>
                      <p className="mt-1 text-xs text-tertiary">
                        {t('shifts.form.eventHint')}
                      </p>
                    </div>
                  )}

                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('shifts.form.name')}
                        placeholder={t('shifts.form.namePlaceholder')}
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
                      <Textarea
                        label={t('shifts.form.description')}
                        placeholder={t('shifts.form.descriptionPlaceholder')}
                        rows={3}
                        value={field.value}
                        onChange={field.onChange}
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
                    {t('shifts.createPlan')}
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
