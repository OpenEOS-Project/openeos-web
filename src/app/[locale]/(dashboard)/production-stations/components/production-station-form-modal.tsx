'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import {
  useProductionStations,
  useCreateProductionStation,
  useUpdateProductionStation,
} from '@/hooks/use-production-stations';
import { usePrinters } from '@/hooks/use-printers';
import { devicesApi } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import type { ProductionStation } from '@/types/production-station';

const productionStationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  color: z.string().optional(),
  handoffStationId: z.string().optional(),
  printerId: z.string().optional(),
  displayDeviceId: z.string().optional(),
  isActive: z.boolean(),
});

type ProductionStationFormData = z.infer<typeof productionStationSchema>;

interface ProductionStationFormModalProps {
  isOpen: boolean;
  eventId: string;
  organizationId: string;
  station?: ProductionStation | null;
  onClose: () => void;
}

export function ProductionStationFormModal({
  isOpen,
  eventId,
  organizationId,
  station,
  onClose,
}: ProductionStationFormModalProps) {
  const t = useTranslations('productionStations');
  const tCommon = useTranslations('common');
  const isEditing = !!station;

  const { data: stations } = useProductionStations(eventId);
  const createStation = useCreateProductionStation();
  const updateStation = useUpdateProductionStation();
  const { data: printers } = usePrinters(organizationId);
  const { data: devices } = useQuery({
    queryKey: ['devices', organizationId],
    queryFn: () => devicesApi.list(organizationId),
    enabled: !!organizationId,
    select: (res) => res.data?.filter((d) => d.type === 'display') || [],
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductionStationFormData>({
    resolver: zodResolver(productionStationSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '',
      handoffStationId: '',
      printerId: '',
      displayDeviceId: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (station) {
      reset({
        name: station.name,
        description: station.description || '',
        color: station.color || '',
        handoffStationId: station.handoffStationId || '',
        printerId: station.printerId || '',
        displayDeviceId: station.displayDeviceId || '',
        isActive: station.isActive,
      });
    } else {
      reset({
        name: '',
        description: '',
        color: '',
        handoffStationId: '',
        printerId: '',
        displayDeviceId: '',
        isActive: true,
      });
    }
  }, [station, reset]);

  const onSubmit = async (data: ProductionStationFormData) => {
    if (!eventId) return;

    try {
      if (isEditing && station) {
        await updateStation.mutateAsync({
          eventId,
          id: station.id,
          data: {
            name: data.name,
            description: data.description || undefined,
            color: data.color || undefined,
            handoffStationId: data.handoffStationId || null,
            printerId: data.printerId || null,
            displayDeviceId: data.displayDeviceId || null,
            isActive: data.isActive,
          },
        });
      } else {
        await createStation.mutateAsync({
          eventId,
          data: {
            name: data.name,
            description: data.description || undefined,
            color: data.color || undefined,
            handoffStationId: data.handoffStationId || null,
            printerId: data.printerId || null,
            displayDeviceId: data.displayDeviceId || null,
            isActive: data.isActive,
          },
        });
      }
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Filter out current station for handoff selection (cannot hand off to self)
  const availableHandoffStations = stations?.filter((s) => s.id !== station?.id) || [];

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {isEditing ? t('edit') : t('create')}
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
                        placeholder=""
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="color"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.color')}
                        type="color"
                        value={field.value || '#6366f1'}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="handoffStationId"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                          {t('form.handoffStation')}
                        </label>
                        <select
                          className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        >
                          <option value="">{t('form.noHandoff')}</option>
                          {availableHandoffStations.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-tertiary">
                          {t('form.handoffStationHint')}
                        </p>
                      </div>
                    )}
                  />

                  <Controller
                    name="printerId"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                          {t('form.printer')}
                        </label>
                        <select
                          className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        >
                          <option value="">{t('form.noPrinter')}</option>
                          {printers?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  />

                  <Controller
                    name="displayDeviceId"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                          {t('form.displayDevice')}
                        </label>
                        <select
                          className="w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-solid focus:outline-none focus:ring-2 focus:ring-brand-solid/20"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        >
                          <option value="">{t('form.noDisplayDevice')}</option>
                          {devices?.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  />

                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center justify-between rounded-lg border border-secondary px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-primary">{t('form.active')}</p>
                        </div>
                        <Toggle
                          isSelected={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                    )}
                  />
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
