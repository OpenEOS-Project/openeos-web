'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useProductionStations, useCreateProductionStation, useUpdateProductionStation } from '@/hooks/use-production-stations';
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

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', margin: 0 }}>{hint}</p>}
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
      name: '', description: '', color: '', handoffStationId: '',
      printerId: '', displayDeviceId: '', isActive: true,
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
      reset({ name: '', description: '', color: '', handoffStationId: '', printerId: '', displayDeviceId: '', isActive: true });
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
            displayDeviceId: data.displayDeviceId || null,
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
            displayDeviceId: data.displayDeviceId || null,
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
      <div className="modal__panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{isEditing ? t('edit') : t('create')}</h2>
          <button className="modal__close" type="button" onClick={handleClose} aria-label={tCommon('close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
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
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={field.value || '#6366f1'}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)', cursor: 'pointer', padding: 2 }}
                      />
                      <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{field.value || '#6366f1'}</span>
                    </div>
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
                name="displayDeviceId"
                control={control}
                render={({ field }) => (
                  <FormRow label={t('form.displayDevice')}>
                    <select className="select" value={field.value || ''} onChange={field.onChange} onBlur={field.onBlur}>
                      <option value="">{t('form.noDisplayDevice')}</option>
                      {devices?.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </FormRow>
                )}
              />

              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 10,
                    border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                    cursor: 'pointer',
                  }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{t('form.active')}</p>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--green-ink)' }}
                    />
                  </label>
                )}
              />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? '...' : isEditing ? tCommon('save') : tCommon('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
