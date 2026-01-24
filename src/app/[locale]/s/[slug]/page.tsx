'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import {
  Calendar,
  CalendarPlus01,
  Clock,
  Users01,
  CheckCircle,
  AlertCircle,
  Mail01,
  ArrowLeft,
  Building07,
  Download01,
  List,
  Grid01,
} from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea/textarea';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { shiftsPublicApi } from '@/lib/api-client';

interface ShiftData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredWorkers: number;
  confirmedCount: number;
  availableSpots: number;
  isFull: boolean;
}

interface JobData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  shifts: ShiftData[];
}

interface PlanData {
  id: string;
  name: string;
  description: string | null;
  organization: {
    name: string;
    logoUrl: string | null;
  };
  event: {
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  settings: { allowMultipleShifts: boolean; maxShiftsPerPerson?: number };
  jobs: JobData[];
}

type RegistrationStep = 'select' | 'form' | 'success';

const formSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function PublicShiftPlanPage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations();

  const [step, setStep] = useState<RegistrationStep>('select');
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [registeredShiftsData, setRegisteredShiftsData] = useState<Array<{ job: JobData; shift: ShiftData }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const { data: planData, isLoading, isError } = useQuery({
    queryKey: ['public-shift-plan', slug],
    queryFn: () => shiftsPublicApi.getPlan(slug),
    enabled: !!slug,
  });

  const registerMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsPublicApi.register(slug, {
        ...data,
        shiftIds: Array.from(selectedShifts),
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      // Save the registered shifts data for calendar export
      const shiftsData: Array<{ job: JobData; shift: ShiftData }> = [];
      const planJobs = (planData?.data as PlanData | undefined)?.jobs || [];
      for (const shiftId of selectedShifts) {
        for (const job of planJobs) {
          const shift = job.shifts.find(s => s.id === shiftId);
          if (shift) {
            shiftsData.push({ job, shift });
            break;
          }
        }
      }
      setRegisteredShiftsData(shiftsData);
      setStep('success');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const plan = planData?.data as PlanData | undefined;

  // Group shifts by date for better display
  const shiftsByDate = useMemo(() => {
    if (!plan) return {};

    const grouped: Record<string, Array<{ job: JobData; shift: ShiftData }>> = {};

    for (const job of plan.jobs) {
      for (const shift of job.shifts) {
        if (!grouped[shift.date]) {
          grouped[shift.date] = [];
        }
        grouped[shift.date].push({ job, shift });
      }
    }

    // Sort each day's shifts by time
    for (const date of Object.keys(grouped)) {
      grouped[date].sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
    }

    return grouped;
  }, [plan]);

  const sortedDates = useMemo(() => {
    return Object.keys(shiftsByDate).sort();
  }, [shiftsByDate]);

  // Helper to convert time string to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if two shifts overlap (same day and overlapping times)
  // Allow up to 45 minutes overlap for handover/training time
  const HANDOVER_TOLERANCE_MINUTES = 45;

  const shiftsOverlap = (shift1: ShiftData, date1: string, shift2: ShiftData, date2: string): boolean => {
    if (date1 !== date2) return false;

    const start1 = timeToMinutes(shift1.startTime);
    const end1 = timeToMinutes(shift1.endTime);
    const start2 = timeToMinutes(shift2.startTime);
    const end2 = timeToMinutes(shift2.endTime);

    // Calculate actual overlap in minutes
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

    // Only consider it a conflict if overlap exceeds handover tolerance
    return overlapMinutes > HANDOVER_TOLERANCE_MINUTES;
  };

  // Find shift data by ID
  const findShiftById = (shiftId: string): { job: JobData; shift: ShiftData } | null => {
    for (const job of plan?.jobs || []) {
      const shift = job.shifts.find(s => s.id === shiftId);
      if (shift) return { job, shift };
    }
    return null;
  };

  // Check if a shift overlaps with any selected shift
  const getOverlappingShift = (shift: ShiftData): { job: JobData; shift: ShiftData } | null => {
    for (const selectedId of selectedShifts) {
      if (selectedId === shift.id) continue; // Don't check against itself
      const selectedData = findShiftById(selectedId);
      if (selectedData && shiftsOverlap(shift, shift.date, selectedData.shift, selectedData.shift.date)) {
        return selectedData;
      }
    }
    return null;
  };

  const handleShiftToggle = (shiftId: string, isFull: boolean, hasOverlap: boolean) => {
    if (isFull || hasOverlap) return;

    const newSelected = new Set(selectedShifts);
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId);
    } else {
      // Check if multiple shifts are allowed
      if (!plan?.settings.allowMultipleShifts && newSelected.size > 0) {
        // Replace selection
        newSelected.clear();
      }
      // Check max shifts per person
      if (plan?.settings.maxShiftsPerPerson && newSelected.size >= plan.settings.maxShiftsPerPerson) {
        return;
      }
      newSelected.add(shiftId);
    }
    setSelectedShifts(newSelected);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatEventDates = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    return `${start.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
    })} - ${end.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`;
  };

  // Format time to HH:MM (remove seconds if present)
  const formatTime = (time: string): string => {
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  // Calendar export helpers
  const formatDateTimeForICS = (dateStr: string, timeStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    const [hours, minutes] = timeStr.split(':');
    return `${year}${month}${day}T${hours}${minutes}00`;
  };

  const formatDateTimeForGoogle = (dateStr: string, timeStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    const [hours, minutes] = timeStr.split(':');
    return `${year}${month}${day}T${hours}${minutes}00`;
  };

  const generateICSContent = (shifts: Array<{ job: JobData; shift: ShiftData }>): string => {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const events = shifts.map(({ job, shift }) => {
      const dtStart = formatDateTimeForICS(shift.date, shift.startTime);
      const dtEnd = formatDateTimeForICS(shift.date, shift.endTime);
      const summary = `${job.name} - ${plan?.name || 'Schicht'}`;
      const description = plan?.organization?.name
        ? `Schicht bei ${plan.organization.name}${plan.event ? ` - ${plan.event.name}` : ''}`
        : '';
      const uid = `${shift.id}@openeos.app`;

      return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT`;
    });

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpenEOS//Shift Plan//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events.join('\n')}
END:VCALENDAR`;
  };

  const downloadICS = () => {
    const icsContent = generateICSContent(registeredShiftsData);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan?.name || 'schichten'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openGoogleCalendar = (shiftData: { job: JobData; shift: ShiftData }) => {
    const { job, shift } = shiftData;
    const dtStart = formatDateTimeForGoogle(shift.date, shift.startTime);
    const dtEnd = formatDateTimeForGoogle(shift.date, shift.endTime);
    const title = encodeURIComponent(`${job.name} - ${plan?.name || 'Schicht'}`);
    const details = encodeURIComponent(
      plan?.organization?.name
        ? `Schicht bei ${plan.organization.name}${plan.event ? ` - ${plan.event.name}` : ''}`
        : ''
    );

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}`;
    window.open(url, '_blank');
  };

  const onSubmit = (data: FormData) => {
    if (selectedShifts.size === 0) {
      setError('Bitte wähle mindestens eine Schicht aus');
      return;
    }
    setError(null);
    registerMutation.mutate(data);
  };

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-secondary" />
              <div className="space-y-2">
                <div className="h-6 w-48 rounded bg-secondary" />
                <div className="h-4 w-32 rounded bg-secondary" />
              </div>
            </div>
            <div className="h-32 rounded-xl bg-secondary" />
            <div className="h-48 rounded-xl bg-secondary" />
            <div className="h-48 rounded-xl bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary to-primary p-4">
        <div className="w-full max-w-md rounded-2xl border border-secondary bg-primary p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error-secondary">
            <AlertCircle className="h-8 w-8 text-error-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-primary">
            {t('shifts.public.notFound')}
          </h2>
          <p className="mt-3 text-secondary">
            {t('shifts.public.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  // Success step
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary p-4">
        <div className="mx-auto max-w-md pt-8">
          <div className="rounded-2xl border border-secondary bg-primary p-8 shadow-lg">
            {/* Success Icon */}
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-secondary">
                <CheckCircle className="h-8 w-8 text-success-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-primary">
                {t('shifts.public.registrationSuccess')}
              </h2>
              <p className="mt-3 text-secondary">
                {t('shifts.public.checkEmail')}
              </p>
            </div>

            {/* Registered Shifts with Calendar Options */}
            {registeredShiftsData.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-medium text-secondary">
                  {t('shifts.public.yourShifts')}
                </h3>
                <div className="space-y-3">
                  {registeredShiftsData.map(({ job, shift }) => (
                    <div
                      key={shift.id}
                      className="rounded-xl border border-secondary bg-secondary/30 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: job.color || '#6b7280' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary">{job.name}</p>
                          <p className="mt-1 text-sm text-secondary">
                            {formatDate(shift.date).split(',')[0]}, {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </p>
                          {/* Google Calendar Button */}
                          <button
                            type="button"
                            onClick={() => openGoogleCalendar({ job, shift })}
                            className="mt-2 flex items-center gap-1.5 text-sm text-brand-primary hover:underline"
                          >
                            <CalendarPlus01 className="h-4 w-4" />
                            {t('shifts.public.addToGoogleCalendar')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Download All as ICS */}
                <Button
                  className="mt-4 w-full"
                  color="secondary"
                  iconLeading={Download01}
                  onClick={downloadICS}
                >
                  {t('shifts.public.downloadICS')}
                </Button>
              </div>
            )}

            {/* Register More Button */}
            <Button
              className="mt-6 w-full"
              color="tertiary"
              onClick={() => {
                setStep('select');
                setSelectedShifts(new Set());
                setRegisteredShiftsData([]);
              }}
            >
              {t('shifts.public.registerMore')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
      {/* Header with Logo */}
      <header className="sticky top-0 z-10 border-b border-secondary bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary/80">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center gap-4">
            {plan.organization.logoUrl ? (
              <Image
                src={plan.organization.logoUrl}
                alt={plan.organization.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-secondary">
                <Building07 className="h-6 w-6 text-brand-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-primary">
                {plan.organization.name}
              </h1>
              {plan.event && (
                <p className="truncate text-sm text-tertiary">
                  {plan.event.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {step === 'select' && (
          <>
            {/* Plan Info Card */}
            <div className="mb-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">{plan.name}</h2>

              {plan.event && (
                <div className="mt-2 flex items-center gap-2 text-sm text-brand-primary">
                  <Calendar className="h-4 w-4" />
                  <span>{formatEventDates(plan.event.startDate, plan.event.endDate)}</span>
                </div>
              )}

              {plan.description && (
                <p className="mt-3 text-secondary">{plan.description}</p>
              )}

              {/* Instructions */}
              <div className="mt-4 rounded-lg bg-secondary/50 p-3">
                <p className="text-sm text-secondary">
                  {plan.settings.allowMultipleShifts
                    ? plan.settings.maxShiftsPerPerson
                      ? t('shifts.public.selectMultipleMax', { max: plan.settings.maxShiftsPerPerson })
                      : t('shifts.public.selectMultiple')
                    : t('shifts.public.selectOne')}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-secondary">
                {selectedShifts.size > 0 && (
                  <span className="text-brand-primary">
                    {selectedShifts.size} {t('shifts.public.selected')}
                  </span>
                )}
              </span>
              <div className="flex rounded-lg border border-secondary bg-primary p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-brand-secondary text-brand-primary'
                      : 'text-tertiary hover:text-primary'
                  }`}
                >
                  <List className="h-4 w-4" />
                  {t('shifts.public.listView')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-brand-secondary text-brand-primary'
                      : 'text-tertiary hover:text-primary'
                  }`}
                >
                  <Grid01 className="h-4 w-4" />
                  {t('shifts.public.calendarView')}
                </button>
              </div>
            </div>

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <div className="mb-6 rounded-2xl border border-secondary bg-primary shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-secondary/30">
                        <th className="sticky left-0 z-10 bg-secondary/30 px-4 py-3 text-left text-sm font-medium text-secondary min-w-[140px]">
                          {t('shifts.calendar.job')}
                        </th>
                        {sortedDates.map((date) => {
                          const dateObj = new Date(date);
                          return (
                            <th
                              key={date}
                              className="px-2 py-3 text-center text-sm font-medium text-secondary min-w-[120px]"
                            >
                              <div className="text-xs text-tertiary">
                                {dateObj.toLocaleDateString('de-DE', { weekday: 'short' })}
                              </div>
                              <div>
                                {dateObj.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary">
                      {plan.jobs.map((job) => (
                        <tr key={job.id}>
                          <td className="sticky left-0 z-10 bg-primary px-4 py-3 border-r border-secondary">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: job.color || '#6b7280' }}
                              />
                              <div>
                                <div className="text-sm font-medium text-primary">{job.name}</div>
                                {job.description && (
                                  <div className="text-xs text-tertiary truncate max-w-[120px]">
                                    {job.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {sortedDates.map((date) => {
                            const shiftsForDay = job.shifts
                              .filter(s => s.date === date)
                              .sort((a, b) => a.startTime.localeCompare(b.startTime));

                            if (shiftsForDay.length === 0) {
                              return (
                                <td key={date} className="px-2 py-2 text-center text-xs text-quaternary align-top">
                                  —
                                </td>
                              );
                            }

                            return (
                              <td key={date} className="px-2 py-2 align-top">
                                <div className="space-y-1.5">
                                  {shiftsForDay.map((shift) => {
                                    const isSelected = selectedShifts.has(shift.id);
                                    const overlappingShift = !isSelected ? getOverlappingShift(shift) : null;
                                    const hasOverlap = !!overlappingShift;
                                    const isDisabled = shift.isFull || hasOverlap;

                                    return (
                                      <button
                                        key={shift.id}
                                        type="button"
                                        disabled={isDisabled}
                                        onClick={() => handleShiftToggle(shift.id, shift.isFull, hasOverlap)}
                                        className={`w-full rounded-lg border p-2 text-left text-xs transition-colors ${
                                          isDisabled
                                            ? 'cursor-not-allowed opacity-50 border-secondary bg-secondary/20'
                                            : isSelected
                                            ? 'border-brand-primary bg-brand-secondary'
                                            : 'border-secondary bg-secondary/30 hover:border-brand-primary hover:bg-brand-secondary/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1 text-secondary mb-1">
                                          <Clock className="h-3 w-3" />
                                          <span className="font-medium">
                                            {formatTime(shift.startTime)}-{formatTime(shift.endTime)}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className={`flex items-center gap-1 ${
                                            shift.isFull
                                              ? 'text-green-600 dark:text-green-400'
                                              : 'text-tertiary'
                                          }`}>
                                            <Users01 className="h-3 w-3" />
                                            {shift.confirmedCount}/{shift.requiredWorkers}
                                          </span>
                                          {shift.isFull ? (
                                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                              {t('shifts.public.full')}
                                            </span>
                                          ) : hasOverlap ? (
                                            <span className="text-[10px] text-orange-600 dark:text-orange-400">
                                              {t('shifts.public.overlap')}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-green-600 dark:text-green-400">
                                              {shift.availableSpots} {t('shifts.public.free')}
                                            </span>
                                          )}
                                        </div>
                                        {isSelected && (
                                          <div className="mt-1 flex items-center gap-1 text-brand-primary">
                                            <CheckCircle className="h-3 w-3" />
                                            <span className="text-[10px] font-medium">{t('shifts.public.selected')}</span>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* List View - Shifts by date */}
            {viewMode === 'list' && (
            <div className="space-y-4">
              {sortedDates.map((date) => (
                <div key={date} className="rounded-2xl border border-secondary bg-primary shadow-sm overflow-hidden">
                  {/* Date Header */}
                  <div className="border-b border-secondary bg-secondary/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-brand-primary" />
                      <h3 className="font-semibold text-primary">{formatDate(date)}</h3>
                    </div>
                  </div>

                  {/* Shifts */}
                  <div className="divide-y divide-secondary">
                    {shiftsByDate[date].map(({ job, shift }) => {
                      const isSelected = selectedShifts.has(shift.id);
                      const overlappingShift = !isSelected ? getOverlappingShift(shift) : null;
                      const hasOverlap = !!overlappingShift;
                      const isDisabled = shift.isFull || hasOverlap;

                      return (
                        <button
                          key={shift.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleShiftToggle(shift.id, shift.isFull, hasOverlap)}
                          className={`w-full p-4 text-left transition-colors ${
                            isDisabled
                              ? 'cursor-not-allowed opacity-60'
                              : isSelected
                              ? 'bg-brand-secondary'
                              : 'hover:bg-secondary/30 active:bg-secondary/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className="mt-0.5">
                              <Checkbox
                                isSelected={isSelected}
                                isDisabled={isDisabled}
                                onChange={() => {}}
                              />
                            </div>

                            {/* Job Color Dot */}
                            <div
                              className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: job.color || '#6b7280' }}
                            />

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-primary">{job.name}</p>
                                  {job.description && (
                                    <p className="mt-0.5 text-sm text-tertiary line-clamp-1">
                                      {job.description}
                                    </p>
                                  )}
                                </div>

                                {/* Status Badge */}
                                {shift.isFull ? (
                                  <span className="flex-shrink-0 rounded-full bg-error-secondary px-2.5 py-1 text-xs font-medium text-error-primary">
                                    Voll
                                  </span>
                                ) : hasOverlap ? (
                                  <span className="flex-shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                    {t('shifts.public.overlap')}
                                  </span>
                                ) : (
                                  <span className="flex-shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    {shift.availableSpots} frei
                                  </span>
                                )}
                              </div>

                              {/* Time & Workers */}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users01 className="h-4 w-4" />
                                  {shift.confirmedCount}/{shift.requiredWorkers}
                                </span>
                              </div>

                              {/* Overlap hint */}
                              {hasOverlap && overlappingShift && (
                                <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                                  {t('shifts.public.overlapsWith', {
                                    job: overlappingShift.job.name,
                                    time: `${formatTime(overlappingShift.shift.startTime)} - ${formatTime(overlappingShift.shift.endTime)}`,
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Spacer for fixed button */}
            <div className="h-24" />

            {/* Fixed Continue Button */}
            <div className="fixed inset-x-0 bottom-0 border-t border-secondary bg-primary/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-primary/80">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
                <span className="text-sm text-secondary">
                  {selectedShifts.size === 0 ? (
                    t('shifts.public.selectShifts')
                  ) : (
                    <>
                      {selectedShifts.size} {selectedShifts.size === 1 ? 'Schicht' : 'Schichten'} ausgewählt
                    </>
                  )}
                </span>
                <Button
                  color="primary"
                  onClick={() => setStep('form')}
                  isDisabled={selectedShifts.size === 0}
                >
                  {t('shifts.public.continue')}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'form' && (
          <div className="pb-8">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setStep('select')}
              className="mb-4 flex items-center gap-1 text-sm text-brand-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('shifts.public.backToSelection')}
            </button>

            <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">
                {t('shifts.public.yourDetails')}
              </h2>

              {/* Selected shifts summary */}
              <div className="mt-4 rounded-xl bg-secondary/50 p-4">
                <p className="text-sm font-medium text-secondary">
                  {t('shifts.public.selectedShifts')}:
                </p>
                <ul className="mt-2 space-y-2">
                  {Array.from(selectedShifts).map((shiftId) => {
                    const found = plan.jobs
                      .flatMap((j) => j.shifts.map((s) => ({ job: j, shift: s })))
                      .find((x) => x.shift.id === shiftId);
                    if (!found) return null;
                    return (
                      <li key={shiftId} className="flex items-center gap-2 text-sm">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: found.job.color || '#6b7280' }}
                        />
                        <span className="text-primary">
                          <span className="font-medium">{found.job.name}</span>
                          {' • '}
                          {formatDate(found.shift.date).split(',')[0]}
                          {', '}
                          {formatTime(found.shift.startTime)}-{formatTime(found.shift.endTime)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                    {error}
                  </div>
                )}

                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label={t('shifts.public.name')}
                      placeholder={t('shifts.public.namePlaceholder')}
                      isInvalid={!!errors.name}
                      hint={errors.name?.message}
                    />
                  )}
                />

                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="email"
                      label={t('shifts.public.email')}
                      placeholder={t('shifts.public.emailPlaceholder')}
                      isInvalid={!!errors.email}
                      hint={errors.email?.message}
                    />
                  )}
                />

                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="tel"
                      label={t('shifts.public.phone')}
                      placeholder={t('shifts.public.phonePlaceholder')}
                    />
                  )}
                />

                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      label={t('shifts.public.notes')}
                      placeholder={t('shifts.public.notesPlaceholder')}
                      rows={3}
                    />
                  )}
                />

                <p className="text-xs text-tertiary">
                  {t('shifts.public.emailHint')}
                </p>

                <Button
                  type="submit"
                  color="primary"
                  className="w-full"
                  isLoading={registerMutation.isPending}
                  isDisabled={registerMutation.isPending}
                >
                  {t('shifts.public.register')}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t border-secondary bg-primary/50 py-6 ${step === 'select' ? 'pb-24' : ''}`}>
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            {/* OpenEOS Logo & Branding */}
            <div className="flex items-center gap-2">
              <Image
                src="/logo_small_dark.png"
                alt="OpenEOS"
                width={24}
                height={24}
                className="h-6 w-6 dark:hidden"
              />
              <Image
                src="/logo_small_light.png"
                alt="OpenEOS"
                width={24}
                height={24}
                className="hidden h-6 w-6 dark:block"
              />
              <span className="text-sm text-tertiary">
                Powered by <span className="font-medium text-secondary">OpenEOS</span>
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-4 text-sm text-tertiary">
              <span>© {new Date().getFullYear()} OpenEOS</span>
              <span className="text-quaternary">•</span>
              <a
                href="/impressum"
                className="hover:text-secondary hover:underline"
              >
                Impressum
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
