'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Select } from '@/components/ui/select/select';
import { useCreateInvitation } from '@/hooks/use-members';
import type { OrganizationRole } from '@/types/auth';

interface InviteMemberModalProps {
  isOpen: boolean;
  organizationId: string;
  onClose: () => void;
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const roles: { value: OrganizationRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kassierer' },
  { value: 'kitchen', label: 'Kueche' },
  { value: 'delivery', label: 'Ausgabe' },
];

export function InviteMemberModal({ isOpen, organizationId, onClose }: InviteMemberModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);

  const createInvitation = useCreateInvitation(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: '',
      role: 'cashier',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    setError(null);

    try {
      await createInvitation.mutateAsync({
        email: data.email,
        role: data.role,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">{t('invite')}</h2>
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
                  {error && (
                    <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600 ring-1 ring-error-200 ring-inset dark:bg-error-950 dark:text-error-400 dark:ring-error-800">
                      {error}
                    </div>
                  )}

                  <Controller
                    name="email"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Input
                        type="email"
                        label={t('form.email')}
                        placeholder={t('form.emailPlaceholder')}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        isInvalid={!!errors.email}
                        autoComplete="email"
                      />
                    )}
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-secondary">
                      {t('form.role')}
                    </label>
                    <Controller
                      name="role"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <Select
                          selectedKey={field.value}
                          onSelectionChange={(key) => field.onChange(key)}
                          isInvalid={!!errors.role}
                        >
                          {roles.map((role) => (
                            <Select.Item key={role.value} id={role.value}>
                              {role.label}
                            </Select.Item>
                          ))}
                        </Select>
                      )}
                    />
                    {errors.role && (
                      <p className="mt-1.5 text-sm text-error-primary">{t('form.roleRequired')}</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button type="button" color="secondary" onClick={handleClose}>
                    {tCommon('cancel')}
                  </Button>
                  <Button type="submit" isLoading={createInvitation.isPending}>
                    {t('invite')}
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
