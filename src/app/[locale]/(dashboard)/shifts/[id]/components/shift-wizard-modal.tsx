'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Users01,
  Check,
} from '@untitledui/icons';

import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { ShiftPlan } from '@/types/shift';

interface GeneratedShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  enabled: boolean;
}

interface ShiftWizardModalProps {
  open: boolean;
  jobId: string | null;
  plan: ShiftPlan;
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Datum', 'Zeit', 'Konfiguration', 'Vorschau'];

export function ShiftWizardModal({ open, jobId, plan, onClose }: ShiftWizardModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Step 2: Time range
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('22:00');

  // Step 3: Configuration (stored as strings for better UX during editing)
  const [shiftsPerDay, setShiftsPerDay] = useState('3');
  const [workersPerShift, setWorkersPerShift] = useState('2');
  const [overlapMinutes, setOverlapMinutes] = useState('0');

  // Step 4: Generated shifts
  const [generatedShifts, setGeneratedShifts] = useState<GeneratedShift[]>([]);

  // Get event dates if available for pre-filling
  const eventStartDate = plan.event?.startDate
    ? new Date(plan.event.startDate).toISOString().split('T')[0]
    : '';
  const eventEndDate = plan.event?.endDate
    ? new Date(plan.event.endDate).toISOString().split('T')[0]
    : '';

  // Auto-fill event dates when modal opens
  useEffect(() => {
    if (open && plan.event?.startDate && plan.event?.endDate) {
      setStartDate(eventStartDate);
      setEndDate(eventEndDate);
    }
  }, [open, plan.event, eventStartDate, eventEndDate]);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Time conversion helpers
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Parse configuration values
  const shiftsPerDayNum = parseInt(shiftsPerDay) || 0;
  const workersPerShiftNum = parseInt(workersPerShift) || 0;
  const overlapMins = parseInt(overlapMinutes) || 0;

  // Calculate shift duration
  const calculateShiftDuration = useMemo(() => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const totalMinutes = endMins - startMins;
    if (totalMinutes <= 0 || shiftsPerDayNum <= 0) return 0;
    return Math.floor(totalMinutes / shiftsPerDayNum);
  }, [startTime, endTime, shiftsPerDayNum]);

  // Generate shifts for preview
  const generateShiftsPreview = () => {
    const shifts: GeneratedShift[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError('Bitte wähle gültige Daten aus');
      return;
    }

    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const totalMinutes = endMins - startMins;

    if (totalMinutes <= 0) {
      setError('Endzeit muss nach Startzeit liegen');
      return;
    }

    const shiftDuration = Math.floor(totalMinutes / shiftsPerDayNum);

    // For each day
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];

      // For each shift in the day
      for (let i = 0; i < shiftsPerDayNum; i++) {
        const shiftStart = startMins + i * shiftDuration;
        // Add overlap to end time for handover (except last shift of the day)
        const isLastShift = i === shiftsPerDayNum - 1;
        const shiftEnd = shiftStart + shiftDuration + (isLastShift ? 0 : overlapMins);

        shifts.push({
          id: generateId(),
          date: dateStr,
          startTime: minutesToTime(shiftStart),
          endTime: minutesToTime(shiftEnd),
          requiredWorkers: workersPerShiftNum,
          enabled: true,
        });
      }
    }

    setGeneratedShifts(shifts);
    setError(null);
    setStep(4);
  };

  // Toggle shift enabled
  const toggleShift = (shiftId: string) => {
    setGeneratedShifts((shifts) =>
      shifts.map((s) => (s.id === shiftId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Update shift workers
  const updateShiftWorkers = (shiftId: string, workers: number) => {
    setGeneratedShifts((shifts) =>
      shifts.map((s) =>
        s.id === shiftId ? { ...s, requiredWorkers: Math.max(1, workers) } : s
      )
    );
  };

  // Update shift start time
  const updateShiftStartTime = (shiftId: string, time: string) => {
    setGeneratedShifts((shifts) =>
      shifts.map((s) => (s.id === shiftId ? { ...s, startTime: time } : s))
    );
  };

  // Update shift end time
  const updateShiftEndTime = (shiftId: string, time: string) => {
    setGeneratedShifts((shifts) =>
      shifts.map((s) => (s.id === shiftId ? { ...s, endTime: time } : s))
    );
  };

  // Group generated shifts by date
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, GeneratedShift[]> = {};
    for (const shift of generatedShifts) {
      if (!grouped[shift.date]) {
        grouped[shift.date] = [];
      }
      grouped[shift.date].push(shift);
    }
    return grouped;
  }, [generatedShifts]);

  const enabledShiftsCount = generatedShifts.filter((s) => s.enabled).length;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !jobId) return;

      const enabledShifts = generatedShifts.filter((s) => s.enabled);
      const shiftsToCreate = enabledShifts.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredWorkers: s.requiredWorkers,
      }));

      return shiftsApi.createShiftsBulk(organizationId, jobId, shiftsToCreate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const handleClose = () => {
    setStep(1);
    setStartDate('');
    setEndDate('');
    setStartTime('10:00');
    setEndTime('22:00');
    setShiftsPerDay('3');
    setWorkersPerShift('2');
    setOverlapMinutes('0');
    setGeneratedShifts([]);
    setError(null);
    onClose();
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const canProceedStep1 = startDate && endDate && new Date(startDate) <= new Date(endDate);
  const canProceedStep2 = timeToMinutes(endTime) > timeToMinutes(startTime);
  const canProceedStep3 = shiftsPerDayNum >= 1 && workersPerShiftNum >= 1;

  if (!open) return null;

  return (
    <div
      className="modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="modal__panel" style={{ maxWidth: 560, width: '100%' }}>
        {/* Header */}
        <div className="modal__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
                className="btn btn--ghost"
                style={{ padding: '6px', minWidth: 'unset' }}
                aria-label="Zurück"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {t('shifts.wizard.title')}
            </h2>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {STEP_LABELS.map((label, i) => {
                const stepNum = (i + 1) as WizardStep;
                const isActive = stepNum === step;
                const isDone = stepNum < step;
                return (
                  <div
                    key={label}
                    title={label}
                    style={{
                      width: isActive ? 24 : 8,
                      height: 8,
                      borderRadius: 4,
                      transition: 'all 0.2s',
                      background: isActive
                        ? 'var(--green-ink)'
                        : isDone
                        ? 'color-mix(in oklab, var(--green-ink) 40%, transparent)'
                        : 'color-mix(in oklab, var(--ink) 12%, transparent)',
                    }}
                  />
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {t('shifts.wizard.step', { current: step, total: 4 })}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn--ghost"
              style={{ padding: '6px', minWidth: 'unset' }}
              aria-label="Schließen"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal__body">
          {error && (
            <div
              style={{
                marginBottom: 16,
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                background: 'color-mix(in oklab, var(--red, #dc2626) 10%, transparent)',
                color: 'var(--red, #dc2626)',
                border: '1px solid color-mix(in oklab, var(--red, #dc2626) 20%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          {/* Step 1: Date Range */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)' }}>
                <Calendar className="size-5" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t('shifts.wizard.selectDates')}</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="auth-field">
                  <span>{t('shifts.wizard.startDate')}</span>
                  <input
                    type="date"
                    className="input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="auth-field">
                  <span>{t('shifts.wizard.endDate')}</span>
                  <input
                    type="date"
                    className="input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>

              {startDate && endDate && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  {t('shifts.wizard.daysCount', {
                    count: Math.ceil(
                      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1,
                  })}
                </p>
              )}
            </div>
          )}

          {/* Step 2: Time Range */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)' }}>
                <Clock className="size-5" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t('shifts.wizard.selectTimes')}</h3>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                {t('shifts.wizard.timesDescription')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="auth-field">
                  <span>{t('shifts.wizard.startTime')}</span>
                  <input
                    type="time"
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
                <label className="auth-field">
                  <span>{t('shifts.wizard.endTime')}</span>
                  <input
                    type="time"
                    className="input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </label>
              </div>

              {canProceedStep2 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  {t('shifts.wizard.totalHours', {
                    hours: Math.round(
                      (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60 * 10
                    ) / 10,
                  })}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Configuration */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)' }}>
                <Users01 className="size-5" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t('shifts.wizard.configure')}</h3>
              </div>

              <label className="auth-field">
                <span>{t('shifts.wizard.shiftsPerDay')}</span>
                <input
                  type="number"
                  className="input"
                  value={shiftsPerDay}
                  onChange={(e) =>
                    setShiftsPerDay(String(Math.min(10, Math.max(1, parseInt(e.target.value) || 1))))
                  }
                />
              </label>

              {calculateShiftDuration > 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)' }}>
                  {t('shifts.wizard.shiftDuration', {
                    hours: Math.round(calculateShiftDuration / 60 * 10) / 10,
                  })}
                </p>
              )}

              <label className="auth-field">
                <span>{t('shifts.wizard.workersPerShift')}</span>
                <input
                  type="number"
                  className="input"
                  value={workersPerShift}
                  onChange={(e) =>
                    setWorkersPerShift(String(Math.min(50, Math.max(1, parseInt(e.target.value) || 1))))
                  }
                />
              </label>

              {/* Overlap selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                  {t('shifts.wizard.overlap')}
                </label>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-faint)' }}>
                  {t('shifts.wizard.overlapDescription')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[0, 15, 30, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setOverlapMinutes(String(mins))}
                      className={overlapMins === mins ? 'btn btn--primary' : 'btn btn--ghost'}
                      style={{ fontSize: 13 }}
                    >
                      {mins === 0 ? t('shifts.wizard.noOverlap') : `${mins} min`}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  padding: '12px 14px',
                  background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                }}
              >
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                  {t('shifts.wizard.summary')}:
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-faint)' }}>
                  {t('shifts.wizard.summaryText', {
                    days: Math.ceil(
                      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1,
                    shiftsPerDay: shiftsPerDayNum,
                    totalShifts:
                      (Math.ceil(
                        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      ) + 1) * shiftsPerDayNum,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Preview & Adjust */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)' }}>
                  <Check className="size-5" />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{t('shifts.wizard.preview')}</h3>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  {enabledShiftsCount} / {generatedShifts.length} {t('shifts.wizard.selected')}
                </span>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(shiftsByDate).map(([date, shifts]) => (
                  <div
                    key={date}
                    style={{
                      borderRadius: 8,
                      border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                        background: 'color-mix(in oklab, var(--ink) 3%, transparent)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {formatDateDisplay(date)}
                    </div>
                    <div>
                      {shifts.map((shift, idx) => (
                        <div
                          key={shift.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            opacity: shift.enabled ? 1 : 0.45,
                            borderTop: idx > 0 ? '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' : undefined,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={shift.enabled}
                            onChange={() => toggleShift(shift.id)}
                            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                          />
                          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}>
                            <input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) => updateShiftStartTime(shift.id, e.target.value)}
                              disabled={!shift.enabled}
                              className="input"
                              style={{ width: 90, padding: '3px 8px', fontSize: 13 }}
                            />
                            <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>–</span>
                            <input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) => updateShiftEndTime(shift.id, e.target.value)}
                              disabled={!shift.enabled}
                              className="input"
                              style={{ width: 90, padding: '3px 8px', fontSize: 13 }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ padding: '2px 8px', minWidth: 'unset', fontSize: 14, fontWeight: 600 }}
                              onClick={() => updateShiftWorkers(shift.id, shift.requiredWorkers - 1)}
                              disabled={!shift.enabled}
                            >
                              -
                            </button>
                            <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
                              {shift.requiredWorkers}
                            </span>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ padding: '2px 8px', minWidth: 'unset', fontSize: 14, fontWeight: 600 }}
                              onClick={() => updateShiftWorkers(shift.id, shift.requiredWorkers + 1)}
                              disabled={!shift.enabled}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {t('common.cancel')}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {step === 1 && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                {t('common.next')}
                <ArrowRight className="size-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                {t('common.next')}
                <ArrowRight className="size-4" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={generateShiftsPreview}
                disabled={!canProceedStep3}
              >
                {t('shifts.wizard.generatePreview')}
                <ArrowRight className="size-4" />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => createMutation.mutate()}
                disabled={enabledShiftsCount === 0 || createMutation.isPending}
              >
                {createMutation.isPending
                  ? '...'
                  : t('shifts.wizard.createShifts', { count: enabledShiftsCount })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
