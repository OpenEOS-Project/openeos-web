'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { countryName } from '@/lib/countries';
import { OPERATING_MODE_SETTINGS_HREF } from '@/lib/operating-mode';
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
  const locale = useLocale();
  const country = currentOrganization?.organization?.country ?? null;

  const updateOrg = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        // Bestehende Felder (z. B. ein altes Freitext-Land) bleiben stehen.
        settings: { ...settings, contact: { ...settings.contact, ...data } },
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

        {/* Das Land ist das der Organisation (organizations.country) — es
            steuert die wählbaren Betriebsarten und wird unter „Betriebsart“
            festgelegt. */}
        <div className="auth-field">
          <span className="auth-field__label">{t('country')}</span>
          <p style={{ margin: 0, fontSize: 14 }} data-testid="contact-country">
            {country ? countryName(country, locale) : t('countryMissing')}{' '}
            <Link href={OPERATING_MODE_SETTINGS_HREF} className="notice-link" style={{ fontSize: 12 }}>
              {country ? t('countryLocked') : t('countrySet')}
            </Link>
          </p>
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
