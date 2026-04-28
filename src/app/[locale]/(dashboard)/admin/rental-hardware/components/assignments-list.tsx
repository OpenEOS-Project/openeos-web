'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Play,
  CornerDownLeft,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { Dropdown } from '@/components/ui/dropdown/dropdown';
import {
  useRentalAssignments,
  useActivateRental,
  useReturnRental,
} from '@/hooks/use-rentals';
import { AssignmentFormModal } from './assignment-form-modal';
import type { RentalAssignmentStatus } from '@/types/rental';
import type { BadgeColors } from '@/components/ui/badges/badge-types';

const statusConfig: Record<RentalAssignmentStatus, BadgeColors> = {
  pending: 'gray',
  confirmed: 'brand',
  active: 'success',
  returned: 'gray',
  cancelled: 'error',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AssignmentsList() {
  const t = useTranslations('admin.rental.assignments');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: assignments, isLoading } = useRentalAssignments();
  const activateMutation = useActivateRental();
  const returnMutation = useReturnRental();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-secondary bg-primary p-6 shadow-xs">
          <EmptyState
            icon="settings"
            title={t('title')}
            description={t('noAssignments')}
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
          <AssignmentFormModal onClose={() => setShowCreateModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-tertiary">
          {assignments.length} {t('title')}
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
                {t('table.hardware')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.organization')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.period')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.amount')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-tertiary">
                {t('table.status')}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-tertiary">
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary bg-primary">
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-primary">
                    {assignment.rentalHardware?.name ?? '-'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-secondary">
                    {assignment.organization?.name ?? '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-secondary">
                    {formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}
                  </span>
                  <p className="text-xs text-tertiary">{assignment.totalDays} {t('days')}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-primary">
                    {formatCurrency(assignment.totalAmount)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge color={statusConfig[assignment.status]} size="sm">
                    {t(`status.${assignment.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Dropdown.Root>
                    <Dropdown.DotsButton />
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu>
                        {(assignment.status === 'confirmed' || assignment.status === 'pending') && (
                          <Dropdown.Item
                            onAction={() => activateMutation.mutate(assignment.id)}
                            isDisabled={activateMutation.isPending}
                            icon={Play}
                            label={t('activate')}
                          />
                        )}
                        {assignment.status === 'active' && (
                          <Dropdown.Item
                            onAction={() => returnMutation.mutate(assignment.id)}
                            isDisabled={returnMutation.isPending}
                            icon={CornerDownLeft}
                            label={t('return')}
                          />
                        )}
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
        <AssignmentFormModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}
