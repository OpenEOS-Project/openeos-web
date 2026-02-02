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
  Trash01,
} from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
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

  return (
    <DialogTrigger isOpen={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-xl">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <div className="flex items-center gap-3">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => (s - 1) as WizardStep)}
                      className="rounded-lg p-1.5 text-fg-quaternary transition hover:bg-secondary"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                  )}
                  <h2 className="text-lg font-semibold text-primary">
                    {t('shifts.wizard.title')}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-tertiary">
                    {t('shifts.wizard.step', { current: step, total: 4 })}
                  </span>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5">
                {error && (
                  <div className="mb-4 rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                    {error}
                  </div>
                )}

                {/* Step 1: Date Range */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-secondary">
                      <Calendar className="h-5 w-5" />
                      <h3 className="font-medium">{t('shifts.wizard.selectDates')}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="date"
                        label={t('shifts.wizard.startDate')}
                        value={startDate}
                        onChange={(value) => setStartDate(value)}
                      />
                      <Input
                        type="date"
                        label={t('shifts.wizard.endDate')}
                        value={endDate}
                        onChange={(value) => setEndDate(value)}
                      />
                    </div>

                    {startDate && endDate && (
                      <p className="text-sm text-tertiary">
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-secondary">
                      <Clock className="h-5 w-5" />
                      <h3 className="font-medium">{t('shifts.wizard.selectTimes')}</h3>
                    </div>

                    <p className="text-sm text-tertiary">
                      {t('shifts.wizard.timesDescription')}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="time"
                        label={t('shifts.wizard.startTime')}
                        value={startTime}
                        onChange={(value) => setStartTime(value)}
                      />
                      <Input
                        type="time"
                        label={t('shifts.wizard.endTime')}
                        value={endTime}
                        onChange={(value) => setEndTime(value)}
                      />
                    </div>

                    {canProceedStep2 && (
                      <p className="text-sm text-tertiary">
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-secondary">
                      <Users01 className="h-5 w-5" />
                      <h3 className="font-medium">{t('shifts.wizard.configure')}</h3>
                    </div>

                    <Input
                      type="number"
                      label={t('shifts.wizard.shiftsPerDay')}
                      value={shiftsPerDay}
                      onChange={(value) => setShiftsPerDay(String(Math.min(10, Math.max(1, parseInt(value) || 1))))}
                    />

                    {calculateShiftDuration > 0 && (
                      <p className="text-sm text-tertiary">
                        {t('shifts.wizard.shiftDuration', {
                          hours: Math.round(calculateShiftDuration / 60 * 10) / 10,
                        })}
                      </p>
                    )}

                    <Input
                      type="number"
                      label={t('shifts.wizard.workersPerShift')}
                      value={workersPerShift}
                      onChange={(value) => setWorkersPerShift(String(Math.min(50, Math.max(1, parseInt(value) || 1))))}
                    />

                    {/* Overlap selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-secondary">
                        {t('shifts.wizard.overlap')}
                      </label>
                      <p className="text-xs text-tertiary">
                        {t('shifts.wizard.overlapDescription')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[0, 15, 30, 45].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setOverlapMinutes(String(mins))}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                              overlapMins === mins
                                ? 'bg-brand-primary text-white'
                                : 'bg-secondary text-secondary hover:bg-secondary/80'
                            }`}
                          >
                            {mins === 0 ? t('shifts.wizard.noOverlap') : `${mins} min`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-sm font-medium text-secondary">
                        {t('shifts.wizard.summary')}:
                      </p>
                      <p className="mt-1 text-sm text-tertiary">
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
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-secondary">
                        <Check className="h-5 w-5" />
                        <h3 className="font-medium">{t('shifts.wizard.preview')}</h3>
                      </div>
                      <span className="text-sm text-tertiary">
                        {enabledShiftsCount} / {generatedShifts.length} {t('shifts.wizard.selected')}
                      </span>
                    </div>

                    <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
                      {Object.entries(shiftsByDate).map(([date, shifts]) => (
                        <div key={date} className="rounded-lg border border-secondary">
                          <div className="border-b border-secondary bg-secondary/30 px-3 py-2">
                            <span className="font-medium text-primary">
                              {formatDateDisplay(date)}
                            </span>
                          </div>
                          <div className="divide-y divide-secondary">
                            {shifts.map((shift) => (
                              <div
                                key={shift.id}
                                className={`flex items-center gap-2 px-3 py-2 ${
                                  !shift.enabled ? 'opacity-50' : ''
                                }`}
                              >
                                <Checkbox
                                  isSelected={shift.enabled}
                                  onChange={() => toggleShift(shift.id)}
                                />
                                <div className="flex flex-1 items-center gap-1">
                                  <input
                                    type="time"
                                    value={shift.startTime}
                                    onChange={(e) =>
                                      updateShiftStartTime(shift.id, e.target.value)
                                    }
                                    disabled={!shift.enabled}
                                    className="w-20 rounded border border-secondary bg-primary px-1.5 py-0.5 text-sm text-primary focus:border-brand-primary focus:outline-none disabled:opacity-50"
                                  />
                                  <span className="text-tertiary">-</span>
                                  <input
                                    type="time"
                                    value={shift.endTime}
                                    onChange={(e) =>
                                      updateShiftEndTime(shift.id, e.target.value)
                                    }
                                    disabled={!shift.enabled}
                                    className="w-20 rounded border border-secondary bg-primary px-1.5 py-0.5 text-sm text-primary focus:border-brand-primary focus:outline-none disabled:opacity-50"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-secondary disabled:opacity-50"
                                    onClick={() =>
                                      updateShiftWorkers(shift.id, shift.requiredWorkers - 1)
                                    }
                                    disabled={!shift.enabled}
                                  >
                                    <span className="text-sm font-medium text-secondary">-</span>
                                  </button>
                                  <span className="w-6 text-center text-sm text-primary">
                                    {shift.requiredWorkers}
                                  </span>
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-secondary disabled:opacity-50"
                                    onClick={() =>
                                      updateShiftWorkers(shift.id, shift.requiredWorkers + 1)
                                    }
                                    disabled={!shift.enabled}
                                  >
                                    <span className="text-sm font-medium text-secondary">+</span>
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
              <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                <Button type="button" color="secondary" onClick={handleClose}>
                  {t('common.cancel')}
                </Button>

                {step === 1 && (
                  <Button
                    color="primary"
                    iconTrailing={ArrowRight}
                    onClick={() => setStep(2)}
                    isDisabled={!canProceedStep1}
                  >
                    {t('common.next')}
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    color="primary"
                    iconTrailing={ArrowRight}
                    onClick={() => setStep(3)}
                    isDisabled={!canProceedStep2}
                  >
                    {t('common.next')}
                  </Button>
                )}

                {step === 3 && (
                  <Button
                    color="primary"
                    iconTrailing={ArrowRight}
                    onClick={generateShiftsPreview}
                    isDisabled={!canProceedStep3}
                  >
                    {t('shifts.wizard.generatePreview')}
                  </Button>
                )}

                {step === 4 && (
                  <Button
                    color="primary"
                    onClick={() => createMutation.mutate()}
                    isLoading={createMutation.isPending}
                    isDisabled={enabledShiftsCount === 0 || createMutation.isPending}
                  >
                    {t('shifts.wizard.createShifts', { count: enabledShiftsCount })}
                  </Button>
                )}
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
