'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useRentalAssignments,
  useActivateRental,
  useReturnRental,
} from '@/hooks/use-rentals';
import { AssignmentFormModal } from './assignment-form-modal';
import type { RentalAssignmentStatus } from '@/types/rental';

const statusBadge: Record<RentalAssignmentStatus, string> = {
  pending: 'badge badge--neutral',
  confirmed: 'badge badge--info',
  active: 'badge badge--success',
  returned: 'badge badge--neutral',
  cancelled: 'badge badge--error',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <>
        <div className="app-card">
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="empty-state__title">{t('title')}</h3>
            <p className="empty-state__sub">{t('noAssignments')}</p>
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>
              {t('add')}
            </button>
          </div>
        </div>
        {showCreateModal && <AssignmentFormModal onClose={() => setShowCreateModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="app-card app-card--flat">
        <div className="app-card__head">
          <span style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
            {assignments.length} {t('title')}
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
                      {assignment.totalDays} {t('days')}
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
