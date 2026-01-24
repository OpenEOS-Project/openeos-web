'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash01, Edit03, Calendar, MagicWand01 } from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftJob, Shift } from '@/types/shift';
import { AddJobModal } from './add-job-modal';
import { AddShiftModal } from './add-shift-modal';
import { ShiftWizardModal } from './shift-wizard-modal';

// Format time to HH:MM (remove seconds if present)
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
  const [editingJob, setEditingJob] = useState<ShiftJob | null>(null);

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

  const getConfirmedCount = (shift: Shift) => {
    return shift.registrations?.filter((r) => r.status === 'confirmed').length || 0;
  };

  if (jobs.length === 0) {
    return (
      <>
        <EmptyState
          icon="clipboard"
          title={t('shifts.editor.noJobs')}
          description={t('shifts.editor.noJobsDescription')}
          action={
            <Button color="primary" iconLeading={Plus} onClick={() => setShowAddJobModal(true)}>
              {t('shifts.editor.addJob')}
            </Button>
          }
        />
        <AddJobModal
          open={showAddJobModal}
          planId={plan.id}
          onClose={() => setShowAddJobModal(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-primary">
          {t('shifts.editor.addJob').replace('hinzufügen', '').replace('Add ', '')} ({jobs.length})
        </h2>
        <Button color="primary" size="sm" iconLeading={Plus} onClick={() => setShowAddJobModal(true)}>
          {t('shifts.editor.addJob')}
        </Button>
      </div>

      <div className="space-y-4">
        {jobs
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-secondary bg-primary overflow-hidden"
            >
              {/* Job Header */}
              <div
                className="flex items-center justify-between p-4 border-b border-secondary"
                style={{ borderLeftWidth: 4, borderLeftColor: job.color || '#6b7280' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: job.color || '#6b7280' }}
                  />
                  <div>
                    <h3 className="font-medium text-primary">{job.name}</h3>
                    {job.description && (
                      <p className="text-sm text-tertiary">{job.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    color="secondary"
                    size="sm"
                    iconLeading={MagicWand01}
                    onClick={() => handleOpenWizard(job.id)}
                  >
                    {t('shifts.wizard.button')}
                  </Button>
                  <Button
                    color="secondary"
                    size="sm"
                    iconLeading={Plus}
                    onClick={() => handleAddShift(job.id)}
                  >
                    {t('shifts.editor.addShift')}
                  </Button>
                  <Button
                    color="secondary-destructive"
                    size="sm"
                    iconLeading={Trash01}
                    onClick={() => {
                      if (confirm(t('shifts.confirmDelete'))) {
                        deleteJobMutation.mutate(job.id);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Shifts List */}
              <div className="divide-y divide-secondary">
                {(!job.shifts || job.shifts.length === 0) ? (
                  <div className="p-4 text-center text-sm text-tertiary">
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
                          className="flex items-center justify-between p-4 hover:bg-secondary/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-tertiary" />
                              <span className="font-medium text-primary">
                                {formatDate(shift.date)}
                              </span>
                            </div>
                            <span className="text-sm text-secondary">
                              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className={`text-sm ${isFull ? 'text-success-primary font-medium' : 'text-tertiary'}`}
                            >
                              {confirmedCount} / {shift.requiredWorkers} {t('shifts.editor.requiredWorkers').toLowerCase()}
                            </span>
                            <Button
                              color="secondary-destructive"
                              size="sm"
                              iconLeading={Trash01}
                              onClick={() => deleteShiftMutation.mutate(shift.id)}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          ))}
      </div>

      <AddJobModal
        open={showAddJobModal}
        planId={plan.id}
        onClose={() => setShowAddJobModal(false)}
      />

      <AddShiftModal
        open={showAddShiftModal}
        jobId={selectedJobId}
        planId={plan.id}
        onClose={() => {
          setShowAddShiftModal(false);
          setSelectedJobId(null);
        }}
      />

      <ShiftWizardModal
        open={showWizardModal}
        jobId={selectedJobId}
        plan={plan}
        onClose={() => {
          setShowWizardModal(false);
          setSelectedJobId(null);
        }}
      />
    </div>
  );
}
