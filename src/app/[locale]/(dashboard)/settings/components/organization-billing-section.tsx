'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const billingSchema = z.object({
  billingEmail: z.string().email().optional().or(z.literal('')),
  vatId: z.string().optional(),
});

type BillingFormData = z.infer<typeof billingSchema>;

export function OrganizationBillingSection() {
  const t = useTranslations('settings.organizationBilling');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const updateOrg = useMutation({
    mutationFn: async (data: BillingFormData) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        billingEmail: data.billingEmail || undefined,
        vatId: data.vatId || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (currentOrganization?.organization) {
        setCurrentOrganization({ ...currentOrganization, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      billingEmail: currentOrganization?.organization?.billingEmail || '',
      vatId: currentOrganization?.organization?.vatId || '',
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
          <label className="auth-field__label" htmlFor="billingEmail">{t('billingEmail')}</label>
          <input id="billingEmail" type="email" className={`input${errors.billingEmail ? ' input--error' : ''}`} placeholder="rechnung@example.com" {...register('billingEmail')} />
          {errors.billingEmail && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.billingEmail.message}</p>}
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="vatId">{t('vatId')}</label>
          <input id="vatId" className="input" placeholder="DE123456789" {...register('vatId')} />
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
