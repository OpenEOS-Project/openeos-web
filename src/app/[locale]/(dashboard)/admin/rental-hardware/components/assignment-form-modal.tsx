'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Select } from '@/components/ui/select/select';
import { Label } from '@/components/ui/input/label';
import { adminApi } from '@/lib/api-client';
import { useRentalHardware, useCreateRentalAssignment } from '@/hooks/use-rentals';
import type { CreateRentalAssignmentData } from '@/types/rental';

interface AssignmentFormModalProps {
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function AssignmentFormModal({ onClose }: AssignmentFormModalProps) {
  const t = useTranslations('admin.rental.assignments');
  const tCommon = useTranslations('common');

  const [hardwareId, setHardwareId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateRentalAssignment();

  // Fetch available hardware
  const { data: hardware } = useRentalHardware({ status: 'available' });
  const availableHardware = hardware ?? [];

  // Fetch all organizations
  const { data: orgsData } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => adminApi.listOrganizations({ limit: 100 }),
  });
  const organizations = orgsData?.data ?? [];

  // Calculate preview
  const selectedHardware = availableHardware.find((hw) => hw.id === hardwareId);
  const preview = useMemo(() => {
    if (!startDate || !endDate || !selectedHardware) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalAmount = totalDays * selectedHardware.dailyRate;
    return { totalDays, totalAmount };
  }, [startDate, endDate, selectedHardware]);

  function handleSubmit() {
    const data: CreateRentalAssignmentData = {
      rentalHardwareId: hardwareId,
      organizationId,
      startDate,
      endDate,
      notes: notes || undefined,
    };
    createMutation.mutate(data, { onSuccess: () => onClose() });
  }

  const isValid = hardwareId && organizationId && startDate && endDate;

  return (
    <DialogModal
      isOpen
      onClose={onClose}
      title={t('add')}
      size="lg"
    >
      <div className="space-y-4 px-6 py-4">
        {/* Hardware */}
        <div className="space-y-1.5">
          <Label>{t('form.hardware')}</Label>
          <Select
            selectedKey={hardwareId || undefined}
            onSelectionChange={(key) => setHardwareId(String(key))}
            aria-label={t('form.hardware')}
            placeholder={t('form.hardwarePlaceholder')}
          >
            {availableHardware.map((hw) => (
              <Select.Item key={hw.id} id={hw.id}>
                {hw.name} ({hw.serialNumber}) - {formatCurrency(hw.dailyRate)}/Tag
              </Select.Item>
            ))}
          </Select>
        </div>

        {/* Organization */}
        <div className="space-y-1.5">
          <Label>{t('form.organization')}</Label>
          <Select
            selectedKey={organizationId || undefined}
            onSelectionChange={(key) => setOrganizationId(String(key))}
            aria-label={t('form.organization')}
            placeholder={t('form.organizationPlaceholder')}
          >
            {organizations.map((org) => (
              <Select.Item key={org.id} id={org.id}>
                {org.name}
              </Select.Item>
            ))}
          </Select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('form.startDate')}
            type="date"
            value={startDate}
            onChange={(val) => setStartDate(val)}
            isRequired
          />
          <Input
            label={t('form.endDate')}
            type="date"
            value={endDate}
            onChange={(val) => setEndDate(val)}
            isRequired
          />
        </div>

        {/* Notes */}
        <Input
          label={t('form.notes')}
          placeholder={t('form.notesPlaceholder')}
          value={notes}
          onChange={(val) => setNotes(val)}
        />

        {/* Preview */}
        {preview && (
          <div className="rounded-lg bg-secondary p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-tertiary">{t('form.totalDays')}</span>
              <span className="text-sm font-medium text-primary">{preview.totalDays}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-tertiary">{t('form.totalAmount')}</span>
              <span className="text-lg font-semibold text-primary">{formatCurrency(preview.totalAmount)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
        <Button type="button" color="secondary" onClick={onClose}>
          {tCommon('cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || createMutation.isPending}
        >
          {createMutation.isPending ? '...' : tCommon('create')}
        </Button>
      </div>
    </DialogModal>
  );
}
