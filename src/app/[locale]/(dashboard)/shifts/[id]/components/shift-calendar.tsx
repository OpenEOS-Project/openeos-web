'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Users01, CheckCircle, AlertCircle, XCircle } from '@untitledui/icons';
import type { ShiftPlan, ShiftJob, Shift, ShiftRegistration, ShiftRegistrationStatus } from '@/types/shift';

interface ShiftCalendarProps {
  plan: ShiftPlan;
}

// Format time to HH:MM (remove seconds if present)
const formatTime = (time: string): string => {
  const parts = time.split(':');
  return `${parts[0]}:${parts[1]}`;
};

const statusConfig: Record<ShiftRegistrationStatus, { color: string; bgColor: string }> = {
  pending_email: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  pending_approval: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  confirmed: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  rejected: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  cancelled: { color: 'text-gray-500 dark:text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

export function ShiftCalendar({ plan }: ShiftCalendarProps) {
  const t = useTranslations();
  const jobs = plan.jobs || [];

  // Get all unique dates from all shifts
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const job of jobs) {
      for (const shift of job.shifts || []) {
        dateSet.add(shift.date);
      }
    }
    return Array.from(dateSet).sort();
  }, [jobs]);

  // Group shifts by job and date for quick lookup
  const shiftsByJobAndDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const job of jobs) {
      for (const shift of job.shifts || []) {
        const key = `${job.id}-${shift.date}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(shift);
      }
    }
    // Sort shifts by start time within each cell
    for (const shifts of map.values()) {
      shifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [jobs]);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      weekday: date.toLocaleDateString('de-DE', { weekday: 'short' }),
      day: date.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }),
    };
  };

  const getRegistrationCounts = (shift: Shift) => {
    const registrations = shift.registrations || [];
    return {
      confirmed: registrations.filter(r => r.status === 'confirmed').length,
      pending: registrations.filter(r => r.status === 'pending_approval' || r.status === 'pending_email').length,
      total: shift.requiredWorkers,
    };
  };

  if (allDates.length === 0) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <p className="text-secondary">{t('shifts.calendar.noShifts')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-secondary bg-secondary/30">
              <th className="sticky left-0 z-10 bg-secondary/30 px-4 py-3 text-left text-sm font-medium text-secondary min-w-[180px]">
                {t('shifts.calendar.job')}
              </th>
              {allDates.map((date) => {
                const { weekday, day } = formatDateHeader(date);
                return (
                  <th
                    key={date}
                    className="px-3 py-3 text-center text-sm font-medium text-secondary min-w-[140px]"
                  >
                    <div className="text-xs text-tertiary">{weekday}</div>
                    <div>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-secondary/20">
                <td className="sticky left-0 z-10 bg-primary px-4 py-3 border-r border-secondary">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: job.color || '#6b7280' }}
                    />
                    <div>
                      <div className="font-medium text-primary text-sm">{job.name}</div>
                      {job.description && (
                        <div className="text-xs text-tertiary truncate max-w-[150px]">
                          {job.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {allDates.map((date) => {
                  const shifts = shiftsByJobAndDate.get(`${job.id}-${date}`) || [];
                  return (
                    <td key={date} className="px-2 py-2 align-top">
                      {shifts.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-quaternary text-xs">
                          —
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {shifts.map((shift) => (
                            <ShiftCell key={shift.id} shift={shift} job={job} />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ShiftCellProps {
  shift: Shift;
  job: ShiftJob;
}

function ShiftCell({ shift, job }: ShiftCellProps) {
  const t = useTranslations();
  const registrations = shift.registrations || [];
  const confirmed = registrations.filter(r => r.status === 'confirmed');
  const pending = registrations.filter(r => r.status === 'pending_approval' || r.status === 'pending_email');
  const isFull = confirmed.length >= shift.requiredWorkers;

  return (
    <div
      className={`rounded-lg border p-2 text-xs ${
        isFull
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : 'border-secondary bg-secondary/30'
      }`}
    >
      {/* Time */}
      <div className="flex items-center gap-1 text-secondary mb-1.5">
        <Clock className="h-3 w-3" />
        <span>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</span>
      </div>

      {/* Capacity */}
      <div className="flex items-center gap-1 mb-2">
        <Users01 className="h-3 w-3 text-tertiary" />
        <span className={isFull ? 'text-green-600 dark:text-green-400 font-medium' : 'text-secondary'}>
          {confirmed.length}/{shift.requiredWorkers}
        </span>
        {pending.length > 0 && (
          <span className="text-orange-600 dark:text-orange-400">
            (+{pending.length})
          </span>
        )}
      </div>

      {/* Registrations */}
      {(confirmed.length > 0 || pending.length > 0) && (
        <div className="space-y-1 border-t border-secondary/50 pt-1.5">
          {confirmed.map((reg) => (
            <div key={reg.id} className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
              <span className="text-primary truncate">{reg.name}</span>
            </div>
          ))}
          {pending.map((reg) => (
            <div key={reg.id} className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <span className="text-tertiary truncate">{reg.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {confirmed.length === 0 && pending.length === 0 && (
        <div className="text-tertiary italic">
          {t('shifts.calendar.noRegistrations')}
        </div>
      )}
    </div>
  );
}
