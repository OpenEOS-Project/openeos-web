'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useProductionStations, useCreateProductionStation, useUpdateProductionStation } from '@/hooks/use-production-stations';
import { usePrinters } from '@/hooks/use-printers';
import type { ProductionStation } from '@/types/production-station';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { SettingToggle } from '@/components/shared/setting-toggle';
import { ColorPicker } from '@/components/shared/color-picker';

// Als Factory, damit die Meldungen ueber next-intl uebersetzt werden —
// ausserhalb der Komponente gibt es noch kein t().
function createProductionStationSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('nameRequired')).max(200),
    description: z.string().optional(),
    color: z.string().optional(),
    handoffStationId: z.string().optional(),
    printerId: z.string().optional(),
    isActive: z.boolean(),
  });
}

type ProductionStationFormData = z.infer<ReturnType<typeof createProductionStationSchema>>;

interface ProductionStationFormModalProps {
  isOpen: boolean;
  eventId: string;
  organizationId: string;
  station?: ProductionStation | null;
  onClose: () => void;
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      {children}
      {hint && <span className="auth-field__hint">{hint}</span>}
    </div>
  );
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
  const tValidation = useTranslations('validation');
  const validationSchema = useMemo(() => createProductionStationSchema(tValidation), [tValidation]);
  const isEditing = !!station;

  const { data: stations } = useProductionStations(eventId);
  const createStation = useCreateProductionStation();
  const updateStation = useUpdateProductionStation();
  const { data: printers } = usePrinters(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductionStationFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '', description: '', color: '', handoffStationId: '',
      printerId: '', isActive: true,
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
        isActive: station.isActive,
      });
    } else {
      reset({ name: '', description: '', color: '', handoffStationId: '', printerId: '', isActive: true });
    }
  }, [station, reset]);

  const onSubmit = async (data: ProductionStationFormData) => {
    if (!eventId) return;
    try {
      if (isEditing && station) {
        await updateStation.mutateAsync({
          eventId, id: station.id,
          data: {
            name: data.name, description: data.description || undefined,
            color: data.color || undefined,
            handoffStationId: data.handoffStationId || null,
            printerId: data.printerId || null,
            isActive: data.isActive,
          },
        });
      } else {
        await createStation.mutateAsync({
          eventId,
          data: {
            name: data.name, description: data.description || undefined,
            color: data.color || undefined,
            handoffStationId: data.handoffStationId || null,
            printerId: data.printerId || null,
            isActive: data.isActive,
          },
        });
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => { reset(); onClose(); };

  const availableHandoffStations = stations?.filter((s) => s.id !== station?.id) || [];

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" onClick={handleClose}>
      <div className="modal__panel modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('edit') : t('create')}</h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.name')} hint={errors.name?.message}>
                    <input
                      className="input"
                      placeholder={t('form.namePlaceholder')}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormRow>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.description')}>
                    <input
                      className="input"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormRow>
                )}
              />

              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.color')}>
                    <ColorPicker
                      value={field.value || '#6366f1'}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormRow>
                )}
              />

              <Controller
                name="handoffStationId"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.handoffStation')} hint={t('form.handoffStationHint')}>
                    <select className="select" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur}>
                      <option value="">{t('form.noHandoff')}</option>
                      {availableHandoffStations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </FormRow>
                )}
              />

              <Controller
                name="printerId"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.printer')}>
                    <select className="select" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur}>
                      <option value="">{t('form.noPrinter')}</option>
                      {printers?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </FormRow>
                )}
              />

              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <SettingToggle
                    label={t('form.active')}
                    checked={!!field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
