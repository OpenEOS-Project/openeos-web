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
  ArrowLeft,
  Building07,
  Download01,
  List,
  Grid01,
} from '@untitledui/icons';

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
      const shiftsDataResult: Array<{ job: JobData; shift: ShiftData }> = [];
      const planJobs = (planData?.data as PlanData | undefined)?.jobs || [];
      for (const shiftId of selectedShifts) {
        for (const job of planJobs) {
          const shift = job.shifts.find(s => s.id === shiftId);
          if (shift) {
            shiftsDataResult.push({ job, shift });
            break;
          }
        }
      }
      setRegisteredShiftsData(shiftsDataResult);
      setStep('success');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const plan = planData?.data as PlanData | undefined;

  const shiftsByDate = useMemo(() => {
    if (!plan) return {};
    const grouped: Record<string, Array<{ job: JobData; shift: ShiftData }>> = {};
    for (const job of plan.jobs) {
      for (const shift of job.shifts) {
        if (!grouped[shift.date]) grouped[shift.date] = [];
        grouped[shift.date].push({ job, shift });
      }
    }
    for (const date of Object.keys(grouped)) {
      grouped[date].sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
    }
    return grouped;
  }, [plan]);

  const sortedDates = useMemo(() => Object.keys(shiftsByDate).sort(), [shiftsByDate]);

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const HANDOVER_TOLERANCE_MINUTES = 45;

  const shiftsOverlap = (shift1: ShiftData, date1: string, shift2: ShiftData, date2: string): boolean => {
    if (date1 !== date2) return false;
    const start1 = timeToMinutes(shift1.startTime);
    const end1 = timeToMinutes(shift1.endTime);
    const start2 = timeToMinutes(shift2.startTime);
    const end2 = timeToMinutes(shift2.endTime);
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
    return overlapMinutes > HANDOVER_TOLERANCE_MINUTES;
  };

  const findShiftById = (shiftId: string): { job: JobData; shift: ShiftData } | null => {
    for (const job of plan?.jobs || []) {
      const shift = job.shifts.find(s => s.id === shiftId);
      if (shift) return { job, shift };
    }
    return null;
  };

  const getOverlappingShift = (shift: ShiftData): { job: JobData; shift: ShiftData } | null => {
    for (const selectedId of selectedShifts) {
      if (selectedId === shift.id) continue;
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
      if (!plan?.settings.allowMultipleShifts && newSelected.size > 0) newSelected.clear();
      if (plan?.settings.maxShiftsPerPerson && newSelected.size >= plan.settings.maxShiftsPerPerson) return;
      newSelected.add(shiftId);
    }
    setSelectedShifts(newSelected);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatEventDates = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  };

  const formatTime = (time: string): string => {
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

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
      return `BEGIN:VEVENT\nUID:${shift.id}@openeos.app\nDTSTAMP:${now}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${summary}\nDESCRIPTION:${description}\nEND:VEVENT`;
    });
    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//OpenEOS//Shift Plan//DE\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n${events.join('\n')}\nEND:VCALENDAR`;
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
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}`, '_blank');
  };

  const onSubmit = (data: FormData) => {
    if (selectedShifts.size === 0) {
      setError('Bitte wähle mindestens eine Schicht aus');
      return;
    }
    setError(null);
    registerMutation.mutate(data);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="app-card"
              style={{ height: i === 1 ? 80 : 140, opacity: 1 - i * 0.2, animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────
  if (isError || !plan) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="app-card" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div className="app-card__body" style={{ padding: '2.5rem 2rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
              background: 'color-mix(in oklab, #d24545 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle style={{ width: 28, height: 28, color: '#d24545' }} />
            </div>
            <h2 className="section-title" style={{ fontSize: 'clamp(22px,4vw,30px)', marginBottom: 12 }}>
              {t('shifts.public.notFound')}
            </h2>
            <p style={{ color: 'var(--mute)', fontSize: 15 }}>{t('shifts.public.notFoundDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Image src="/logo_dark.png" alt="OpenEOS" width={100} height={28} style={{ height: 28, width: 'auto' }} />
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div className="app-card" style={{ maxWidth: 480, width: '100%' }}>
            <div className="app-card__body" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
                background: 'color-mix(in oklab, var(--green-soft) 70%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle style={{ width: 28, height: 28, color: 'var(--green-ink)' }} />
              </div>
              <h2 className="section-title" style={{ fontSize: 'clamp(22px,4vw,30px)', marginBottom: 10 }}>
                {t('shifts.public.registrationSuccess')}
              </h2>
              <p style={{ color: 'var(--mute)', fontSize: 15 }}>{t('shifts.public.checkEmail')}</p>

              {registeredShiftsData.length > 0 && (
                <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                  <p style={{
                    fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '.06em', color: 'var(--mute)', marginBottom: 10,
                  }}>
                    {t('shifts.public.yourShifts')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {registeredShiftsData.map(({ job, shift }) => (
                      <div
                        key={shift.id}
                        style={{
                          border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                          borderRadius: 'var(--r)', padding: '12px 14px',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}
                      >
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                          background: job.color || '#6b7280',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14, margin: 0 }}>{job.name}</p>
                          <p style={{ color: 'var(--mute)', fontSize: 13, margin: '2px 0 0' }}>
                            {formatDate(shift.date).split(',')[0]}, {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                          </p>
                          <button
                            type="button"
                            onClick={() => openGoogleCalendar({ job, shift })}
                            style={{
                              marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                              fontSize: 13, color: 'var(--green-ink)', background: 'none', border: 0,
                              cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                            }}
                          >
                            <CalendarPlus01 style={{ width: 14, height: 14 }} />
                            {t('shifts.public.addToGoogleCalendar')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={downloadICS}
                    className="btn btn--ghost btn--block"
                    style={{ marginTop: 12, gap: 8 }}
                  >
                    <Download01 style={{ width: 16, height: 16 }} />
                    {t('shifts.public.downloadICS')}
                  </button>
                </div>
              )}

              <button
                type="button"
                className="btn btn--ghost btn--block"
                style={{ marginTop: 16 }}
                onClick={() => { setStep('select'); setSelectedShifts(new Set()); setRegisteredShiftsData([]); }}
              >
                {t('shifts.public.registerMore')}
              </button>
            </div>
          </div>
        </main>

        <footer style={{
          padding: '1.25rem', textAlign: 'center',
          borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          fontSize: 13, color: 'var(--mute)',
        }}>
          © {new Date().getFullYear()} OpenEOS
        </footer>
      </div>
    );
  }

  // ── Main page ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        padding: '0.875rem 1.25rem',
        background: 'color-mix(in oklab, var(--paper) 94%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {plan.organization.logoUrl ? (
          <Image
            src={plan.organization.logoUrl}
            alt={plan.organization.name}
            width={40}
            height={40}
            style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8 }}
          />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building07 style={{ width: 20, height: 20, color: 'var(--green-ink)' }} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {plan.organization.name}
          </p>
          {plan.event && (
            <p style={{ fontSize: 13, color: 'var(--mute)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {plan.event.name}
            </p>
          )}
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 680, margin: '0 auto', width: '100%', padding: '1.5rem 1rem' }}>
        {step === 'select' && (
          <>
            {/* Plan info card */}
            <div className="app-card" style={{ marginBottom: '1.25rem' }}>
              <div className="app-card__body">
                <h2 className="app-card__title" style={{ fontSize: 20 }}>{plan.name}</h2>

                {plan.event && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--green-ink)', margin: '6px 0 0' }}>
                    <Calendar style={{ width: 14, height: 14 }} />
                    {formatEventDates(plan.event.startDate, plan.event.endDate)}
                  </p>
                )}

                {plan.description && (
                  <p style={{ marginTop: 10, fontSize: 15, color: 'var(--mute)' }}>{plan.description}</p>
                )}

                <div style={{
                  marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r)',
                  background: 'color-mix(in oklab, var(--ink) 5%, transparent)',
                  fontSize: 14, color: 'var(--mute)',
                }}>
                  {plan.settings.allowMultipleShifts
                    ? plan.settings.maxShiftsPerPerson
                      ? t('shifts.public.selectMultipleMax', { max: plan.settings.maxShiftsPerPerson })
                      : t('shifts.public.selectMultiple')
                    : t('shifts.public.selectOne')}
                </div>
              </div>
            </div>

            {/* View mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: 'var(--green-ink)', fontWeight: 600 }}>
                {selectedShifts.size > 0 ? `${selectedShifts.size} ${t('shifts.public.selected')}` : ''}
              </span>
              <div style={{
                display: 'inline-flex', gap: 2, padding: 3, borderRadius: 'var(--r)',
                border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                background: 'var(--paper)',
              }}>
                {(['list', 'calendar'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 6, border: 0, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      background: viewMode === mode ? 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))' : 'transparent',
                      color: viewMode === mode ? 'var(--green-ink)' : 'var(--mute)',
                      transition: 'background .15s, color .15s',
                    }}
                  >
                    {mode === 'list'
                      ? <><List style={{ width: 14, height: 14 }} />{t('shifts.public.listView')}</>
                      : <><Grid01 style={{ width: 14, height: 14 }} />{t('shifts.public.calendarView')}</>
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar view */}
            {viewMode === 'calendar' && (
              <div className="app-card" style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'color-mix(in oklab, var(--ink) 4%, transparent)' }}>
                      <th style={{
                        padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--f-mono)',
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mute)',
                        fontWeight: 600, borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                        minWidth: 140,
                      }}>
                        {t('shifts.calendar.job')}
                      </th>
                      {sortedDates.map((date) => {
                        const dateObj = new Date(date);
                        return (
                          <th key={date} style={{
                            padding: '10px 8px', textAlign: 'center', fontFamily: 'var(--f-mono)',
                            fontSize: 11, color: 'var(--mute)', fontWeight: 600,
                            borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                            minWidth: 120,
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--mute-2)' }}>
                              {dateObj.toLocaleDateString('de-DE', { weekday: 'short' })}
                            </div>
                            <div>{dateObj.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.jobs.map((job) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
                        <td style={{ padding: '10px 16px', borderRight: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: job.color || '#6b7280' }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{job.name}</div>
                              {job.description && (
                                <div style={{ fontSize: 11, color: 'var(--mute)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                              <td key={date} style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'var(--mute-2)', verticalAlign: 'top' }}>
                                —
                              </td>
                            );
                          }

                          return (
                            <td key={date} style={{ padding: '6px', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                                      style={{
                                        width: '100%', borderRadius: 'var(--r-sm)', padding: '6px 8px',
                                        textAlign: 'left', fontSize: 12, cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        opacity: isDisabled && !isSelected ? 0.5 : 1,
                                        fontFamily: 'inherit', border: '1px solid',
                                        borderColor: isSelected ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 10%, transparent)',
                                        background: isSelected
                                          ? 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))'
                                          : isDisabled
                                          ? 'color-mix(in oklab, var(--ink) 4%, transparent)'
                                          : 'var(--paper)',
                                        transition: 'background .15s, border-color .15s',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--mute)', marginBottom: 3 }}>
                                        <Clock style={{ width: 10, height: 10 }} />
                                        <span style={{ fontWeight: 600 }}>{formatTime(shift.startTime)}–{formatTime(shift.endTime)}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--mute)', fontSize: 11 }}>
                                          <Users01 style={{ width: 10, height: 10 }} />
                                          {shift.confirmedCount}/{shift.requiredWorkers}
                                        </span>
                                        {shift.isFull ? (
                                          <span className="badge badge--success" style={{ fontSize: 9 }}>{t('shifts.public.full')}</span>
                                        ) : hasOverlap ? (
                                          <span className="badge badge--warning" style={{ fontSize: 9 }}>{t('shifts.public.overlap')}</span>
                                        ) : (
                                          <span className="badge badge--neutral" style={{ fontSize: 9 }}>{shift.availableSpots} {t('shifts.public.free')}</span>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--green-ink)', fontSize: 10 }}>
                                          <CheckCircle style={{ width: 10, height: 10 }} />
                                          <span style={{ fontWeight: 600 }}>{t('shifts.public.selected')}</span>
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
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sortedDates.map((date) => (
                  <div key={date} className="app-card">
                    <div className="app-card__head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar style={{ width: 16, height: 16, color: 'var(--green-ink)' }} />
                        <h3 className="app-card__title">{formatDate(date)}</h3>
                      </div>
                    </div>
                    <div className="app-card--flat">
                      {shiftsByDate[date].map(({ job, shift }, idx) => {
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
                            style={{
                              width: '100%', padding: '14px 20px', textAlign: 'left',
                              background: isSelected
                                ? 'color-mix(in oklab, var(--green-soft) 50%, var(--paper))'
                                : 'transparent',
                              border: 0, cursor: isDisabled ? 'not-allowed' : 'pointer',
                              opacity: isDisabled && !isSelected ? 0.6 : 1,
                              fontFamily: 'inherit',
                              borderTop: idx > 0 ? '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' : 'none',
                              transition: 'background .15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              {/* Selection indicator */}
                              <div style={{
                                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                                border: `2px solid ${isSelected ? 'var(--green-ink)' : isDisabled ? 'color-mix(in oklab, var(--ink) 20%, transparent)' : 'color-mix(in oklab, var(--ink) 25%, transparent)'}`,
                                background: isSelected ? 'var(--green-ink)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background .15s, border-color .15s',
                              }}>
                                {isSelected && <CheckCircle style={{ width: 12, height: 12, color: 'var(--paper)' }} />}
                              </div>

                              {/* Job color dot */}
                              <div style={{
                                width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                                background: job.color || '#6b7280',
                              }} />

                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: 0 }}>{job.name}</p>
                                    {job.description && (
                                      <p style={{ fontSize: 13, color: 'var(--mute)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {job.description}
                                      </p>
                                    )}
                                  </div>
                                  {shift.isFull ? (
                                    <span className="badge badge--success">{t('shifts.public.full')}</span>
                                  ) : hasOverlap ? (
                                    <span className="badge badge--warning">{t('shifts.public.overlap')}</span>
                                  ) : (
                                    <span className="badge badge--neutral">{shift.availableSpots} frei</span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6, fontSize: 13, color: 'var(--mute)' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Clock style={{ width: 14, height: 14 }} />
                                    {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                                  </span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Users01 style={{ width: 14, height: 14 }} />
                                    {shift.confirmedCount}/{shift.requiredWorkers}
                                  </span>
                                </div>

                                {hasOverlap && overlappingShift && (
                                  <p style={{ marginTop: 6, fontSize: 12, color: '#8a5e10' }}>
                                    {t('shifts.public.overlapsWith', {
                                      job: overlappingShift.job.name,
                                      time: `${formatTime(overlappingShift.shift.startTime)} – ${formatTime(overlappingShift.shift.endTime)}`,
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

            {/* Spacer for fixed bar */}
            <div style={{ height: 88 }} />

            {/* Fixed continue bar */}
            <div style={{
              position: 'fixed', inset: 'auto 0 0 0', zIndex: 30,
              padding: '0.875rem 1rem',
              background: 'color-mix(in oklab, var(--paper) 94%, transparent)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
            }}>
              <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'var(--mute)' }}>
                  {selectedShifts.size === 0
                    ? t('shifts.public.selectShifts')
                    : `${selectedShifts.size} ${selectedShifts.size === 1 ? 'Schicht' : 'Schichten'} ausgewählt`}
                </span>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={selectedShifts.size === 0}
                  onClick={() => setStep('form')}
                  style={{ opacity: selectedShifts.size === 0 ? 0.5 : 1, cursor: selectedShifts.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {t('shifts.public.continue')}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'form' && (
          <div style={{ paddingBottom: '2rem' }}>
            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep('select')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 14, color: 'var(--green-ink)', background: 'none', border: 0,
                cursor: 'pointer', padding: '0 0 16px', fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {t('shifts.public.backToSelection')}
            </button>

            <div className="app-card">
              <div className="app-card__head">
                <h2 className="app-card__title" style={{ fontSize: 18 }}>{t('shifts.public.yourDetails')}</h2>
              </div>
              <div className="app-card__body">
                {/* Selected shifts summary */}
                <div style={{
                  padding: '12px 14px', borderRadius: 'var(--r)', marginBottom: '1.25rem',
                  background: 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))',
                  border: '1px solid color-mix(in oklab, var(--green) 20%, transparent)',
                }}>
                  <p style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--green-ink)', marginBottom: 8 }}>
                    {t('shifts.public.selectedShifts')}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Array.from(selectedShifts).map((shiftId) => {
                      const found = plan.jobs
                        .flatMap((j) => j.shifts.map((s) => ({ job: j, shift: s })))
                        .find((x) => x.shift.id === shiftId);
                      if (!found) return null;
                      return (
                        <li key={shiftId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: found.job.color || '#6b7280', flexShrink: 0 }} />
                          <span>
                            <strong>{found.job.name}</strong>
                            {' · '}
                            {formatDate(found.shift.date).split(',')[0]}
                            {', '}
                            {formatTime(found.shift.startTime)}–{formatTime(found.shift.endTime)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {error && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 'var(--r)',
                      background: 'color-mix(in oklab, #d24545 10%, transparent)',
                      fontSize: 14, color: '#b13838',
                    }}>
                      {error}
                    </div>
                  )}

                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <label className={`auth-field${errors.name ? ' auth-field--error' : ''}`}>
                        <span>{t('shifts.public.name')}</span>
                        <input
                          {...field}
                          type="text"
                          placeholder={t('shifts.public.namePlaceholder')}
                        />
                        {errors.name && <span className="auth-error">{errors.name.message}</span>}
                      </label>
                    )}
                  />

                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <label className={`auth-field${errors.email ? ' auth-field--error' : ''}`}>
                        <span>{t('shifts.public.email')}</span>
                        <input
                          {...field}
                          type="email"
                          placeholder={t('shifts.public.emailPlaceholder')}
                        />
                        {errors.email && <span className="auth-error">{errors.email.message}</span>}
                      </label>
                    )}
                  />

                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <label className="auth-field">
                        <span>{t('shifts.public.phone')}</span>
                        <input
                          {...field}
                          type="tel"
                          placeholder={t('shifts.public.phonePlaceholder')}
                        />
                      </label>
                    )}
                  />

                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <label className="auth-field">
                        <span>{t('shifts.public.notes')}</span>
                        <textarea
                          {...field}
                          rows={3}
                          placeholder={t('shifts.public.notesPlaceholder')}
                          style={{
                            font: 'inherit', padding: '14px 16px', width: '100%',
                            border: '1px solid color-mix(in oklab, var(--ink) 14%, transparent)',
                            borderRadius: 'var(--r)', background: 'var(--paper)', color: 'var(--ink)',
                            fontSize: 15, resize: 'vertical', outline: 'none',
                          }}
                        />
                      </label>
                    )}
                  />

                  <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>
                    {t('shifts.public.emailHint')}
                  </p>

                  <button
                    type="submit"
                    className="btn btn--primary btn--lg btn--block"
                    disabled={registerMutation.isPending}
                    style={{ opacity: registerMutation.isPending ? 0.7 : 1, cursor: registerMutation.isPending ? 'not-allowed' : 'pointer' }}
                  >
                    {registerMutation.isPending ? '…' : t('shifts.public.register')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1.25rem 1rem', marginTop: 'auto',
        borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, fontSize: 13, color: 'var(--mute)',
        paddingBottom: step === 'select' ? '6.5rem' : '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo_dark.png" alt="OpenEOS" width={80} height={22} style={{ height: 22, width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>© {new Date().getFullYear()} OpenEOS</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="/impressum" style={{ color: 'inherit' }}>Impressum</a>
        </div>
      </footer>
    </div>
  );
}
