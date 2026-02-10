'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { DialogTrigger, Modal, ModalOverlay, Dialog } from '@/components/ui/modal/modal';
import { Toggle } from '@/components/ui/toggle/toggle';
import { useUpdateMember } from '@/hooks/use-members';
import type { OrganizationPermissions, UserOrganization } from '@/types/auth';

interface EditPermissionsModalProps {
  isOpen: boolean;
  organizationId: string;
  member: UserOrganization & { user?: { firstName: string; lastName: string; email: string } };
  onClose: () => void;
}

const PERMISSION_KEYS: (keyof OrganizationPermissions)[] = [
  'products',
  'events',
  'devices',
  'members',
  'shiftPlans',
];

export function EditPermissionsModal({ isOpen, organizationId, member, onClose }: EditPermissionsModalProps) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');

  const [isAdmin, setIsAdmin] = useState(member.role === 'admin');
  const [permissions, setPermissions] = useState<OrganizationPermissions>({
    products: false,
    events: false,
    devices: false,
    members: false,
    shiftPlans: false,
    ...member.permissions,
  });
  const [error, setError] = useState<string | null>(null);

  const updateMember = useUpdateMember(organizationId);

  // Reset state when member changes
  useEffect(() => {
    setIsAdmin(member.role === 'admin');
    setPermissions({
      products: false,
      events: false,
      devices: false,
      members: false,
      shiftPlans: false,
      ...member.permissions,
    });
    setError(null);
  }, [member]);

  const handleSave = async () => {
    setError(null);
    try {
      await updateMember.mutateAsync({
        userId: member.userId,
        role: isAdmin ? 'admin' : 'member',
        permissions: isAdmin ? {} : permissions,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const handleClose = () => {
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
                <div>
                  <h2 className="text-lg font-semibold text-primary">{t('permissions.title')}</h2>
                  <p className="text-sm text-tertiary">
                    {member.user?.firstName} {member.user?.lastName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 px-6 py-5">
                {error && (
                  <div className="rounded-lg bg-error-50 p-3 text-sm text-error-600 ring-1 ring-error-200 ring-inset dark:bg-error-950 dark:text-error-400 dark:ring-error-800">
                    {error}
                  </div>
                )}

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
                <Button
                  type="button"
                  onClick={handleSave}
                  isLoading={updateMember.isPending}
                >
                  {tCommon('save')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
