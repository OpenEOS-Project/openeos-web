'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Receipt } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { FormInput } from '@/components/ui/input/form-input';
import { Label } from '@/components/ui/input/label';
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
        setCurrentOrganization({
          ...currentOrganization,
          organization: data,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      billingEmail: currentOrganization?.organization?.billingEmail || '',
      vatId: currentOrganization?.organization?.vatId || '',
    },
  });

  const onSubmit = async (data: BillingFormData) => {
    await updateOrg.mutateAsync(data);
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary shadow-xs">
      <div className="border-b border-secondary px-6 py-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-tertiary" />
          <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
        </div>
        <p className="text-sm text-tertiary mt-1">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Billing Email */}
        <div className="space-y-1.5">
          <Label htmlFor="billingEmail">{t('billingEmail')}</Label>
          <FormInput
            id="billingEmail"
            type="email"
            {...register('billingEmail')}
            placeholder="rechnung@example.com"
            isInvalid={!!errors.billingEmail}
          />
          {errors.billingEmail && (
            <p className="text-sm text-error-primary">{errors.billingEmail.message}</p>
          )}
        </div>

        {/* VAT ID */}
        <div className="space-y-1.5">
          <Label htmlFor="vatId">{t('vatId')}</Label>
          <FormInput
            id="vatId"
            {...register('vatId')}
            placeholder="DE123456789"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t border-secondary">
          <Button
            type="submit"
            disabled={!isDirty || updateOrg.isPending}
          >
            {updateOrg.isPending ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}
