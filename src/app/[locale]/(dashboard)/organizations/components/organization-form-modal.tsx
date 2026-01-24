'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
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
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      settings: {
        currency: 'EUR',
        timezone: 'Europe/Berlin',
        locale: 'de-DE',
      },
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
        settings: {
          currency: 'EUR',
          timezone: 'Europe/Berlin',
          locale: 'de-DE',
        },
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationFormData) => {
    try {
      if (isEditing && organization) {
        await updateOrganization.mutateAsync({
          id: organization.id,
          data: {
            name: data.name,
            settings: data.settings,
          },
        });
      } else {
        await createOrganization.mutateAsync({
          name: data.name,
          settings: data.settings,
        });
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

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-lg">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {isEditing ? t('actions.edit') : t('create')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 px-6 py-5">
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.name')}
                        placeholder={t('form.namePlaceholder')}
                        isRequired
                        isInvalid={!!errors.name}
                        hint={errors.name?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="settings.currency"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.currency')}
                        placeholder="EUR"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="settings.timezone"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.timezone')}
                        placeholder="Europe/Berlin"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="settings.locale"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('form.locale')}
                        placeholder="de-DE"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button
                    type="button"
                    color="secondary"
                    onClick={handleClose}
                    isDisabled={isSubmitting}
                  >
                    {tCommon('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    isDisabled={isSubmitting}
                  >
                    {isEditing ? tCommon('save') : tCommon('create')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
