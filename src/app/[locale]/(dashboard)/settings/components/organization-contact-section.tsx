'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrganizationSettings } from '@/types/organization';

function createContactSchema(t: (key: string) => string) {
  return z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().url(t('invalidUrl')).optional().or(z.literal('')),
  });
}

type ContactFormData = z.infer<ReturnType<typeof createContactSchema>>;

export function OrganizationContactSection() {
  const t = useTranslations('settings.organizationContact');
  const contactSchema = useMemo(() => createContactSchema(t), [t]);
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const settings = (currentOrganization?.organization?.settings || {}) as OrganizationSettings;

  const updateOrg = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: { ...settings, contact: data },
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      // Setzt das Formular auf die gerade gespeicherten Werte zurueck, sonst
      // bleibt der Speichern-Button nach Erfolg aktiv (isDirty bleibt true).
      reset(variables);
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      address: settings.contact?.address || '',
      city: settings.contact?.city || '',
      zipCode: settings.contact?.zipCode || '',
      country: settings.contact?.country || '',
      phone: settings.contact?.phone || '',
      website: settings.contact?.website || '',
    },
  });

  if (!currentOrganization) return null;

  return (
    <div className="app-card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateOrg.mutateAsync(data))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="address">{t('address')}</label>
          <input id="address" className="input" placeholder={t('placeholders.address')} {...register('address')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="zipCode">{t('zipCode')}</label>
            <input id="zipCode" className="input" placeholder={t('placeholders.zipCode')} {...register('zipCode')} />
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="city">{t('city')}</label>
            <input id="city" className="input" placeholder={t('placeholders.city')} {...register('city')} />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="country">{t('country')}</label>
          <input id="country" className="input" placeholder={t('placeholders.country')} {...register('country')} />
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="phone">{t('phone')}</label>
          <input id="phone" type="tel" className="input" placeholder={t('placeholders.phone')} {...register('phone')} />
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="website">{t('website')}</label>
          <input id="website" type="url" className={`input${errors.website ? ' input--error' : ''}`} placeholder={t('placeholders.website')} {...register('website')} />
          {errors.website && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.website.message}</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
          <button type="submit" className="btn btn--primary" disabled={!isDirty || updateOrg.isPending}>
            {updateOrg.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
