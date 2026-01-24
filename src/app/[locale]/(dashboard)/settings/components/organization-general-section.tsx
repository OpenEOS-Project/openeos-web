'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building07, Upload01, Trash01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { InputGroup } from '@/components/ui/input/input-group';
import { FormInput } from '@/components/ui/input/form-input';
import { Label } from '@/components/ui/input/label';
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
  } = useForm<OrgGeneralFormData>({
    resolver: zodResolver(orgGeneralSchema),
    defaultValues: {
      name: currentOrganization?.organization?.name || '',
      description: currentOrganization?.organization?.settings?.description || '',
    },
  });

  const onSubmit = async (data: OrgGeneralFormData) => {
    await updateOrg.mutateAsync(data);
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary shadow-xs">
      <div className="border-b border-secondary px-6 py-4">
        <div className="flex items-center gap-2">
          <Building07 className="h-5 w-5 text-tertiary" />
          <h2 className="text-lg font-semibold text-primary">{t('title')}</h2>
        </div>
        <p className="text-sm text-tertiary mt-1">{t('description')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary border border-secondary">
              {currentOrganization?.organization?.logoUrl ? (
                <img
                  src={currentOrganization.organization.logoUrl}
                  alt={currentOrganization.organization.name}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <Building07 className="h-8 w-8 text-tertiary" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">{t('logo')}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                color="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload01 className="h-4 w-4 mr-1" />
                {t('uploadLogo')}
              </Button>
              {currentOrganization?.organization?.logoUrl && (
                <Button
                  type="button"
                  color="tertiary"
                  size="sm"
                >
                  <Trash01 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="org-name">{t('name')}</Label>
          <FormInput
            id="org-name"
            {...register('name')}
            isInvalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-error-primary">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="org-description">{t('description_field')}</Label>
          <textarea
            id="org-description"
            {...register('description')}
            rows={3}
            className="w-full rounded-lg border border-secondary bg-primary px-3.5 py-2.5 text-md text-primary placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
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
