'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftJob, Shift } from '@/types/shift';
import { AddJobModal } from './add-job-modal';
import { AddShiftModal } from './add-shift-modal';
import { ShiftWizardModal } from './shift-wizard-modal';

const formatTime = (time: string): string => {
  const parts = time.split(':');
  return `${parts[0]}:${parts[1]}`;
};

interface JobsListProps {
  plan: ShiftPlan;
}

export function JobsList({ plan }: JobsListProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => shiftsApi.deleteJob(organizationId!, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (shiftId: string) => shiftsApi.deleteShift(organizationId!, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
    },
  });

  const jobs = plan.jobs || [];

  const handleAddShift = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowAddShiftModal(true);
  };

  const handleOpenWizard = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowWizardModal(true);
  };

  const getConfirmedCount = (shift: Shift) =>
    shift.registrations?.filter((r) => r.status === 'confirmed').length || 0;

  if (jobs.length === 0) {
    return (
      <>
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('shifts.editor.noJobs')}</h3>
          <p className="empty-state__sub">{t('shifts.editor.noJobsDescription')}</p>
          <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowAddJobModal(true)}>
            {t('shifts.editor.addJob')}
          </button>
        </div>
        <AddJobModal open={showAddJobModal} planId={plan.id} onClose={() => setShowAddJobModal(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('shifts.editor.addJob').replace('hinzufügen', '').replace('Add ', '')} ({jobs.length})
        </span>
        <button className="btn btn--primary" style={{ fontSize: 13 }} onClick={() => setShowAddJobModal(true)}>
          {t('shifts.editor.addJob')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {jobs
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((job) => (
            <div key={job.id} className="app-card app-card--flat" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Job header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderLeft: `4px solid ${job.color || '#6b7280'}`,
                  borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: job.color || '#6b7280', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{job.name}</div>
                    {job.description && (
                      <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>{job.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => handleOpenWizard(job.id)}>
                    {t('shifts.wizard.button')}
                  </button>
                  <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => handleAddShift(job.id)}>
                    {t('shifts.editor.addShift')}
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}
                    onClick={() => {
                      if (confirm(t('shifts.confirmDelete'))) deleteJobMutation.mutate(job.id);
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              {/* Shifts */}
              <div>
                {(!job.shifts || job.shifts.length === 0) ? (
                  <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>
                    {t('shifts.editor.noShifts')}
                  </div>
                ) : (
                  job.shifts
                    .sort((a, b) => {
                      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                      if (dateCompare !== 0) return dateCompare;
                      return a.startTime.localeCompare(b.startTime);
                    })
                    .map((shift) => {
                      const confirmedCount = getConfirmedCount(shift);
                      const isFull = confirmedCount >= shift.requiredWorkers;
                      return (
                        <div
                          key={shift.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(shift.date)}</span>
                            <span className="mono" style={{ fontSize: 12 }}>
                              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: isFull ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 45%, transparent)', fontWeight: isFull ? 600 : 400 }}>
                              {confirmedCount} / {shift.requiredWorkers}
                            </span>
                            <button
                              className="btn btn--ghost"
                              style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}
                              onClick={() => deleteShiftMutation.mutate(shift.id)}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          ))}
      </div>

      <AddJobModal open={showAddJobModal} planId={plan.id} onClose={() => setShowAddJobModal(false)} />
      <AddShiftModal
        open={showAddShiftModal}
        jobId={selectedJobId}
        planId={plan.id}
        onClose={() => { setShowAddShiftModal(false); setSelectedJobId(null); }}
      />
      <ShiftWizardModal
        open={showWizardModal}
        jobId={selectedJobId}
        plan={plan}
        onClose={() => { setShowWizardModal(false); setSelectedJobId(null); }}
      />
    </div>
  );
}
