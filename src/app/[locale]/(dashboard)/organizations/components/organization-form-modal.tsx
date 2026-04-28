'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateOrganization, useUpdateOrganization } from '@/hooks/use-organizations';
import type { Organization } from '@/types';

const organizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  settings: z.object({
    currency: z.string(),
    timezone: z.string(),
    locale: z.string(),
  }),
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
  const updateOrganization = useUpdateOrganization();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      settings: { currency: 'EUR', timezone: 'Europe/Berlin', locale: 'de-DE' },
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
      });
    } else {
      reset({
        name: '',
        settings: { currency: 'EUR', timezone: 'Europe/Berlin', locale: 'de-DE' },
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationFormData) => {
    try {
      if (isEditing && organization) {
        await updateOrganization.mutateAsync({ id: organization.id, data: { name: data.name, settings: data.settings } });
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
      <div className="modal__panel" style={{ maxWidth: 520 }}>
        <div className="modal__head">
          <h2 className="modal__title">
            {isEditing ? t('actions.edit') : t('create')}
          </h2>
          <button type="button" className="btn btn--ghost" style={{ padding: '6px 8px', minWidth: 0 }} onClick={handleClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
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
                <span style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}>{errors.name.message}</span>
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
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? '...' : (isEditing ? tCommon('save') : tCommon('create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
