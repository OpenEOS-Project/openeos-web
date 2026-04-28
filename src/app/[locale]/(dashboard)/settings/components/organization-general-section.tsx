'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const orgGeneralSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().optional(),
});

type OrgGeneralFormData = z.infer<typeof orgGeneralSchema>;

export function OrganizationGeneralSection() {
  const t = useTranslations('settings.organizationGeneral');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateOrg = useMutation({
    mutationFn: async (data: Partial<OrgGeneralFormData>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, data);
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<OrgGeneralFormData>({
    resolver: zodResolver(orgGeneralSchema),
    defaultValues: {
      name: currentOrganization?.organization?.name || '',
      description: currentOrganization?.organization?.settings?.description || '',
    },
  });

  const onSubmit = async (data: OrgGeneralFormData) => { await updateOrg.mutateAsync(data); };

  if (!currentOrganization) return null;

  return (
    <div className="app-card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
        <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', background: 'color-mix(in oklab, var(--ink) 5%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {currentOrganization?.organization?.logoUrl ? (
              <img src={currentOrganization.organization.logoUrl} alt={currentOrganization.organization.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="color-mix(in oklab, var(--ink) 35%, transparent)" strokeWidth="1.5"><path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" /></svg>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('logo')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {t('uploadLogo')}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="org-name">{t('name')}</label>
          <input id="org-name" className="input" {...register('name')} />
          {errors.name && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.name.message}</p>}
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="org-description">{t('description_field')}</label>
          <textarea id="org-description" className="textarea" rows={3} {...register('description')} />
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
