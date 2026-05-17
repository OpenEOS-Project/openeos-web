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
import { EditJobModal } from './edit-job-modal';
import { EditShiftModal } from './edit-shift-modal';
import { Edit01, Plus, Trash01, CalendarPlus01, Stars01 } from '@untitledui/icons';

/** Icon-only square button with a title tooltip — keeps button rows compact
 *  on phones where the previous text labels overflowed off-screen. */
const iconBtnStyle = (variant: 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
  padding: 6,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: variant === 'danger' ? 'var(--red, #dc2626)' : 'inherit',
});

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
  // When set, the wizard targets every job in the plan rather than a single one.
  const [wizardJobIds, setWizardJobIds] = useState<string[]>([]);
  const [editingJob, setEditingJob] = useState<ShiftJob | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

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

  const handleOpenWizardForAll = () => {
    setWizardJobIds(jobs.map((j) => j.id));
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('shifts.editor.addJob').replace('hinzufügen', '').replace('Add ', '')} ({jobs.length})
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn--ghost"
            style={iconBtnStyle('ghost')}
            onClick={handleOpenWizardForAll}
            disabled={jobs.length === 0}
            title="Schicht-Generator für alle Arbeiten"
            aria-label="Schicht-Generator für alle Arbeiten"
          >
            <Stars01 style={{ width: 18, height: 18 }} />
          </button>
          <button
            className="btn btn--primary"
            style={iconBtnStyle('ghost')}
            onClick={() => setShowAddJobModal(true)}
            title={t('shifts.editor.addJob')}
            aria-label={t('shifts.editor.addJob')}
          >
            <Plus style={{ width: 18, height: 18 }} />
          </button>
        </div>
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
                  flexWrap: 'wrap', gap: 10,
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
                    <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 2 }}>
                      Standard: {job.requiredWorkers ?? 1} Helfer pro Schicht
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn--ghost"
                    style={iconBtnStyle()}
                    onClick={() => setEditingJob(job)}
                    title="Arbeit bearbeiten"
                    aria-label="Arbeit bearbeiten"
                  >
                    <Edit01 style={{ width: 16, height: 16 }} />
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={iconBtnStyle()}
                    onClick={() => handleAddShift(job.id)}
                    title={t('shifts.editor.addShift')}
                    aria-label={t('shifts.editor.addShift')}
                  >
                    <CalendarPlus01 style={{ width: 16, height: 16 }} />
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={iconBtnStyle('danger')}
                    onClick={() => {
                      if (confirm(t('shifts.confirmDelete'))) deleteJobMutation.mutate(job.id);
                    }}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Trash01 style={{ width: 16, height: 16 }} />
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
                            flexWrap: 'wrap', gap: 8,
                            padding: '10px 16px',
                            borderBottom: '1px solid color-mix(in oklab, var(--ink) 5%, transparent)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(shift.date)}</span>
                            <span className="mono" style={{ fontSize: 12 }}>
                              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, color: isFull ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 45%, transparent)', fontWeight: isFull ? 600 : 400, whiteSpace: 'nowrap' }}>
                              {confirmedCount} / {shift.requiredWorkers}
                            </span>
                            <button
                              className="btn btn--ghost"
                              style={iconBtnStyle()}
                              onClick={() => setEditingShift(shift)}
                              title="Schicht bearbeiten"
                              aria-label="Schicht bearbeiten"
                            >
                              <Edit01 style={{ width: 16, height: 16 }} />
                            </button>
                            <button
                              className="btn btn--ghost"
                              style={iconBtnStyle('danger')}
                              onClick={() => deleteShiftMutation.mutate(shift.id)}
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                            >
                              <Trash01 style={{ width: 16, height: 16 }} />
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
        jobIds={wizardJobIds}
        plan={plan}
        onClose={() => { setShowWizardModal(false); setWizardJobIds([]); }}
      />
      <EditJobModal
        open={!!editingJob}
        job={editingJob}
        planId={plan.id}
        onClose={() => setEditingJob(null)}
      />
      <EditShiftModal
        open={!!editingShift}
        shift={editingShift}
        planId={plan.id}
        onClose={() => setEditingShift(null)}
      />
    </div>
  );
}
