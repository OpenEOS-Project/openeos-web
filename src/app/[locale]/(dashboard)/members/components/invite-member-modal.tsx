'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Input } from '@/components/ui/input/input';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useCreateInvitation } from '@/hooks/use-members';
import type { OrganizationPermissions } from '@/types/auth';

interface InviteMemberModalProps {
  isOpen: boolean;
  organizationId: string;
  onClose: () => void;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

const inviteSchema = z.object({
  email: z.string().email(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function InviteMemberModal({ isOpen, organizationId, onClose }: InviteMemberModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<OrganizationPermissions>({
    products: false,
    events: false,
    devices: false,
    members: false,
    shiftPlans: false,
  });

  const createInvitation = useCreateInvitation(organizationId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    setError(null);

    try {
      await createInvitation.mutateAsync({
        email: data.email,
        role: isAdmin ? 'admin' : 'member',
        permissions: isAdmin ? undefined : permissions,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const handleClose = () => {
    reset();
    setIsAdmin(false);
    setPermissions({
      products: false,
      events: false,
      devices: false,
      members: false,
      shiftPlans: false,
    });
    setError(null);
    onClose();
  };

  const togglePermission = (key: keyof OrganizationPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
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
                <div className="space-y-5 px-6 py-5">
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

                  {/* Admin toggle */}
                  <Toggle
                    size="md"
                    label={t('form.isAdmin')}
                    hint={t('form.isAdminHint')}
                    isSelected={isAdmin}
                    onChange={setIsAdmin}
                  />

                  {/* Module permissions (only shown for non-admin) */}
                  {!isAdmin && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-secondary">{t('permissions.title')}</p>
                      <div className="space-y-2.5">
                        {PERMISSION_KEYS.map((key) => (
                          <Checkbox
                            key={key}
                            isSelected={!!permissions[key]}
                            onChange={() => togglePermission(key)}
                            label={t(`permissions.${key}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <p className="text-sm text-tertiary">{t('permissions.adminHint')}</p>
                  )}
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
