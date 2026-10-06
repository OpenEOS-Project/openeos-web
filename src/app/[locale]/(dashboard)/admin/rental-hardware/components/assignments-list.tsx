'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clipboard } from 'lucide-react';
import {
  useRentalAssignments,
  useActivateRental,
  useReturnRental,
} from '@/hooks/use-rentals';
import { AssignmentFormModal } from './assignment-form-modal';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import type { RentalAssignmentStatus } from '@/types/rental';

const statusBadge: Record<RentalAssignmentStatus, string> = {
  pending: 'badge badge--neutral',
  confirmed: 'badge badge--info',
  active: 'badge badge--success',
  returned: 'badge badge--neutral',
  cancelled: 'badge badge--error',
};

export function AssignmentsList() {
  const t = useTranslations('admin.rental.assignments');
  const { formatCurrency, formatDate } = useLocaleFormat();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: assignments, isLoading } = useRentalAssignments();
  const activateMutation = useActivateRental();
  const returnMutation = useReturnRental();

  if (isLoading) {
    return <ListLoading />;
  }

  if (!assignments || assignments.length === 0) {
    return (
      <>
        <ListEmpty
          title={t('title')}
          description={t('noAssignments')}
          icon={
            <Clipboard size={28} />
          }
          action={
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>
              {t('add')}
            </button>
          }
        />
        {showCreateModal && <AssignmentFormModal onClose={() => setShowCreateModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
            {t('count', { count: assignments.length })}
          </span>
          <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
            {t('add')}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.hardware')}</th>
                <th>{t('table.organization')}</th>
                <th>{t('table.period')}</th>
                <th className="text-right">{t('table.amount')}</th>
                <th>{t('table.status')}</th>
                <th className="text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td style={{ fontWeight: 600 }}>{assignment.rentalHardware?.name ?? '-'}</td>
                  <td>{assignment.organization?.name ?? '-'}</td>
                  <td>
                    <div className="mono" style={{ fontSize: 13 }}>
                      {formatDate(assignment.startDate)} – {formatDate(assignment.endDate)}
                    </div>
                    <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>
                      {t('daysCount', { count: assignment.totalDays })}
                    </div>
                  </td>
                  <td className="mono text-right" style={{ fontWeight: 600 }}>
                    {formatCurrency(assignment.totalAmount)}
                  </td>
                  <td>
                    <span className={statusBadge[assignment.status]}>
                      {t(`status.${assignment.status}`)}
                    </span>
                  </td>
                  <td className="text-right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(assignment.status === 'confirmed' || assignment.status === 'pending') && (
                        <button
                          className="btn btn--primary"
                          style={{ fontSize: 12 }}
                          onClick={() => activateMutation.mutate(assignment.id)}
                          disabled={activateMutation.isPending}
                        >
                          {t('activate')}
                        </button>
                      )}
                      {assignment.status === 'active' && (
                        <button
                          className="btn btn--ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => returnMutation.mutate(assignment.id)}
                          disabled={returnMutation.isPending}
                        >
                          {t('return')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && <AssignmentFormModal onClose={() => setShowCreateModal(false)} />}
    </>
  );
}
