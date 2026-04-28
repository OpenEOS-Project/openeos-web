'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  HardDrive,
  Edit05,
  Trash01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { useRentalHardware, useDeleteRentalHardware } from '@/hooks/use-rentals';
import { HardwareFormModal } from './hardware-form-modal';
import type { RentalHardware, RentalHardwareStatus } from '@/types/rental';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const statusConfig: Record<RentalHardwareStatus, BadgeColors> = {
  available: 'success',
  rented: 'brand',
  maintenance: 'warning',
  retired: 'gray',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function HardwareList() {
  const t = useTranslations('admin.rental.hardware');
  const tCommon = useTranslations('common');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editHardware, setEditHardware] = useState<RentalHardware | null>(null);
  const [deleteHardware, setDeleteHardware] = useState<RentalHardware | null>(null);

  const { data: hardware, isLoading } = useRentalHardware();
  const deleteMutation = useDeleteRentalHardware();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!hardware || hardware.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="settings"
            title={t('title')}
            description={t('description')}
            action={
              <Button
                size="sm"
                iconLeading={Plus}
                onClick={() => setShowCreateModal(true)}
              >
                {t('add')}
              </Button>
            }
          />
        </div>

        {showCreateModal && (
          <HardwareFormModal onClose={() => setShowCreateModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-tertiary">
          {hardware.length} {t('title')}
        </p>
        <Button
          size="sm"
          iconLeading={Plus}
          onClick={() => setShowCreateModal(true)}
        >
          {t('add')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-secondary">
        <table className="w-full">
          <thead className="bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.name')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.type')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.serial')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.rate')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.status')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.device')}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary bg-primary">
            {hardware.map((hw) => (
              <tr key={hw.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-tertiary">
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-primary">{hw.name}</p>
                      {hw.model && <p className="text-xs text-tertiary">{hw.model}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-secondary">
                    {t(`types.${hw.type}`)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-tertiary font-mono">{hw.serialNumber}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-secondary">{formatCurrency(hw.dailyRate)}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge color={statusConfig[hw.status]} size="sm">
                    {t(`status.${hw.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {hw.device ? (
                    <span className="text-sm text-secondary">{hw.device.name}</span>
                  ) : (
                    <span className="text-sm text-tertiary">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Dropdown.Root>
                    <Dropdown.DotsButton />
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu>
                        <Dropdown.Item
                          onAction={() => setEditHardware(hw)}
                          icon={Edit05}
                          label={t('edit')}
                        />
                        <Dropdown.Item
                          onAction={() => setDeleteHardware(hw)}
                          className="text-error-primary"
                          icon={Trash01}
                          label={t('delete')}
                        />
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <HardwareFormModal onClose={() => setShowCreateModal(false)} />
      )}

      {editHardware && (
        <HardwareFormModal
          hardware={editHardware}
          onClose={() => setEditHardware(null)}
        />
      )}

      {deleteHardware && (
        <DialogModal
          isOpen
          onClose={() => setDeleteHardware(null)}
          title={t('delete')}
          description={t('deleteConfirm', { name: deleteHardware.name })}
        >
          <div className="px-6 py-4">
            <div className="rounded-lg bg-secondary p-4 text-center">
              <p className="font-medium text-primary">{deleteHardware.name}</p>
              <p className="text-sm text-tertiary">{deleteHardware.serialNumber}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
            <Button type="button" color="secondary" onClick={() => setDeleteHardware(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              color="primary-destructive"
              onClick={() => {
                deleteMutation.mutate(deleteHardware.id, {
                  onSuccess: () => setDeleteHardware(null),
                });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '...' : tCommon('delete')}
            </Button>
          </div>
        </DialogModal>
      )}
    </>
  );
}
