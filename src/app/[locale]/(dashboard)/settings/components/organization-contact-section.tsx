'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MarkerPin01, Phone01, Globe01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { FormInput } from '@/components/ui/input/form-input';
import { Label } from '@/components/ui/input/label';
import { useAuthStore } from '@/stores/auth-store';
import { organizationsApi } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrganizationSettings } from '@/types/organization';

const contactSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function OrganizationContactSection() {
  const t = useTranslations('settings.organizationContact');
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const settings = (currentOrganization?.organization?.settings || {}) as OrganizationSettings;

  const updateOrg = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: {
          ...settings,
          contact: data,
        },
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
  } = useForm<ContactFormData>({
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

  const onSubmit = async (data: ContactFormData) => {
    await updateOrg.mutateAsync(data);
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary shadow-xs">
      <div className="border-b border-secondary px-6 py-4">
        <div className="flex items-center gap-2">
          <MarkerPin01 className="h-5 w-5 text-tertiary" />
          <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
        </div>
        <p className="text-sm text-tertiary mt-1">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="address">{t('address')}</Label>
          <FormInput
            id="address"
            {...register('address')}
            placeholder="Musterstraße 123"
          />
        </div>

        {/* City & ZIP */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="zipCode">{t('zipCode')}</Label>
            <FormInput
              id="zipCode"
              {...register('zipCode')}
              placeholder="12345"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">{t('city')}</Label>
            <FormInput
              id="city"
              {...register('city')}
              placeholder="Musterstadt"
            />
          </div>
        </div>

        {/* Country */}
        <div className="space-y-1.5">
          <Label htmlFor="country">{t('country')}</Label>
          <FormInput
            id="country"
            {...register('country')}
            placeholder="Deutschland"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">
            <span className="flex items-center gap-2">
              <Phone01 className="h-4 w-4" />
              {t('phone')}
            </span>
          </Label>
          <FormInput
            id="phone"
            type="tel"
            {...register('phone')}
            placeholder="+49 123 456789"
          />
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="website">
            <span className="flex items-center gap-2">
              <Globe01 className="h-4 w-4" />
              {t('website')}
            </span>
          </Label>
          <FormInput
            id="website"
            type="url"
            {...register('website')}
            placeholder="https://example.com"
            isInvalid={!!errors.website}
          />
          {errors.website && (
            <p className="text-sm text-error-primary">{errors.website.message}</p>
          )}
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
