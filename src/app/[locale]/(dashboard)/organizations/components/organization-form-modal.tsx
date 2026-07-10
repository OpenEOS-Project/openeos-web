'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAdminUpdateOrganization, useCreateOrganization } from '@/hooks/use-organizations';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import { ToggleSwitch } from '@/components/shared/toggle-switch';
import type { Organization } from '@/types';

const organizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  settings: z.object({
    currency: z.string(),
    timezone: z.string(),
    locale: z.string(),
  }),
  billingMode: z.enum(['prepaid', 'invoice']),
  eventPriceOverride: z.string().optional(),
  prioritySupport: z.boolean(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface OrganizationFormModalProps {
  isOpen: boolean;
  organization?: Organization | null;
  onClose: () => void;
}

export function OrganizationFormModal({ isOpen, organization, onClose }: OrganizationFormModalProps) {
  const t = useTranslations('organizations');
  const tCommon = useTranslations('common');
  const isEditing = !!organization;

  const createOrganization = useCreateOrganization();
  const updateOrganization = useAdminUpdateOrganization();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      settings: { currency: 'EUR', timezone: 'Europe/Berlin', locale: 'de-DE' },
      billingMode: 'invoice',
      eventPriceOverride: '',
      prioritySupport: false,
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        name: organization.name,
        settings: {
          currency: organization.settings?.currency || 'EUR',
          timezone: organization.settings?.timezone || 'Europe/Berlin',
          locale: organization.settings?.locale || 'de-DE',
        },
        billingMode: organization.billingMode ?? 'invoice',
        eventPriceOverride:
          typeof organization.eventPriceOverride === 'number' ? String(organization.eventPriceOverride) : '',
        prioritySupport: organization.prioritySupport ?? false,
      });
    } else {
      reset({
        name: '',
        settings: { currency: 'EUR', timezone: 'Europe/Berlin', locale: 'de-DE' },
        billingMode: 'invoice',
        eventPriceOverride: '',
        prioritySupport: false,
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationFormData) => {
    try {
      if (isEditing && organization) {
        const parsedPrice = parseFloat(String(data.eventPriceOverride ?? '').replace(',', '.'));
        const eventPriceOverride =
          data.eventPriceOverride && Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) / 100 : null;
        await updateOrganization.mutateAsync({
          id: organization.id,
          data: {
            name: data.name,
            settings: data.settings,
            billingMode: data.billingMode,
            eventPriceOverride,
            prioritySupport: data.prioritySupport,
          },
        });
      } else {
        await createOrganization.mutateAsync({ name: data.name, settings: data.settings });
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

  if (!isOpen) return null;

  return (
    <div className="modal__overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal__panel modal__panel--md">
        <div className="modal__head">
          <h2 className="modal__title">
            {isEditing ? t('actions.edit') : t('create')}
          </h2>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="auth-field">
              <span>{t('form.name')} *</span>
              <input
                type="text"
                className={`input${errors.name ? ' input--error' : ''}`}
                placeholder={t('form.namePlaceholder')}
                {...register('name')}
              />
              {errors.name && (
                <span style={{ fontSize: 12, color: 'var(--red, var(--danger))' }}>{errors.name.message}</span>
              )}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label className="auth-field">
                <span>{t('form.currency')}</span>
                <input
                  type="text"
                  className="input"
                  placeholder="EUR"
                  {...register('settings.currency')}
                />
              </label>

              <label className="auth-field">
                <span>{t('form.locale')}</span>
                <input
                  type="text"
                  className="input"
                  placeholder="de-DE"
                  {...register('settings.locale')}
                />
              </label>
            </div>

            <label className="auth-field">
              <span>{t('form.timezone')}</span>
              <input
                type="text"
                className="input"
                placeholder="Europe/Berlin"
                {...register('settings.timezone')}
              />
            </label>

            {isEditing && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 6, borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)' }}>
                <label className="auth-field">
                  <span>{t('form.billingMode')}</span>
                  <select className="select" {...register('billingMode')}>
                    <option value="prepaid">{t('form.billingModeOptions.prepaid')}</option>
                    <option value="invoice">{t('form.billingModeOptions.invoice')}</option>
                  </select>
                </label>

                <label className="auth-field">
                  <span>{t('form.eventPriceOverride')}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="input"
                    placeholder={t('form.eventPriceOverrideHint')}
                    {...register('eventPriceOverride')}
                  />
                </label>

                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t('form.prioritySupport')}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink)', opacity: 0.5 }}>{t('form.prioritySupportHint')}</div>
                  </div>
                  <Controller
                    name="prioritySupport"
                    control={control}
                    render={({ field }) => (
                      <ToggleSwitch checked={field.value} onChange={field.onChange} aria-label={t('form.prioritySupport')} />
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : (isEditing ? tCommon('save') : tCommon('create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
