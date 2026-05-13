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
  // Mobil and Liste only — matrix/calendar were dropped because they require
  // horizontal scrolling once the plan has many jobs.
  const [viewMode, setViewMode] = useState<'mobile' | 'list'>('mobile');

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

  // Mobile-view grouping: one section per unique (date, startTime, endTime)
  // slot. Each section lists ONLY the jobs that actually have a shift in
  // that slot — no greyed placeholders, no merging across slightly different
  // time windows. So a 'Bar 18:00–01:00' slot lives in its own section with
  // its single card, and the 19:00–01:00 slot is its own section with all
  // the other jobs.
  const mobileGroups = useMemo(() => {
    type Item = { job: JobData; shift: ShiftData };
    type Group = { date: string; startTime: string; endTime: string; key: string; shifts: Item[] };
    if (!plan) return [] as Group[];

    const groupMap = new Map<string, Group>();
    for (const job of plan.jobs) {
      for (const shift of job.shifts) {
        const key = `${shift.date}|${shift.startTime}|${shift.endTime}`;
        let g = groupMap.get(key);
        if (!g) {
          g = { date: shift.date, startTime: shift.startTime, endTime: shift.endTime, key, shifts: [] };
          groupMap.set(key, g);
        }
        g.shifts.push({ job, shift });
      }
    }

    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    for (const g of groups) {
      g.shifts.sort((a, b) => a.job.name.localeCompare(b.job.name));
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const HANDOVER_TOLERANCE_MINUTES = 45;

  // Convert a (date, startTime, endTime) tuple into an absolute minutes-since-
  // epoch interval. Critically, overnight shifts (endTime <= startTime, e.g.
  // 19:00–01:00) get their end pushed into the next day so the interval is
  // monotonic — otherwise the naïve same-day check below mis-classifies them
  // and lets the user double-book through midnight.
  const shiftBoundsInMinutes = (date: string, startTime: string, endTime: string): [number, number] => {
    const day = Math.floor(new Date(date).getTime() / 86_400_000);
    const startMins = timeToMinutes(startTime);
    let endMins = timeToMinutes(endTime);
    if (endMins <= startMins) endMins += 1440; // wraps midnight
    return [day * 1440 + startMins, day * 1440 + endMins];
  };

  const shiftsOverlap = (shift1: ShiftData, date1: string, shift2: ShiftData, date2: string): boolean => {
    const [start1, end1] = shiftBoundsInMinutes(date1, shift1.startTime, shift1.endTime);
    const [start2, end2] = shiftBoundsInMinutes(date2, shift2.startTime, shift2.endTime);
    const overlapMinutes = Math.min(end1, end2) - Math.max(start1, start2);
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
      <>
        <div className="shifts-public__logo-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </div>
        <main className="shifts-public-wrap" style={{ flex: 1, paddingTop: 32, paddingBottom: 80 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="shifts-public__card"
                style={{ height: i === 1 ? 80 : 140, opacity: 1 - i * 0.2, animation: 'pulse 1.5s ease-in-out infinite' }}
              />
            ))}
          </div>
        </main>
      </>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────
  if (isError || !plan) {
    return (
      <>
        <div className="shifts-public__logo-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </div>
        <main className="shifts-public-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 }}>
          <div className="shifts-public__card" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div className="shifts-public__card-body" style={{ padding: '2.5rem 2rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
                background: 'color-mix(in oklab, #d24545 12%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertCircle style={{ width: 28, height: 28, color: '#d24545' }} />
              </div>
              <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 12 }}>
                {t('shifts.public.notFound')}
              </h2>
              <p style={{ color: 'var(--mute)', fontSize: 15, margin: 0 }}>{t('shifts.public.notFoundDescription')}</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <>
        <div className="shifts-public__logo-bar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </div>
        <header className="shifts-public__context">
          <span className="shifts-public__context-label">
            <b>{plan.organization.name}</b> · Schichtplan
          </span>
          <span className="shifts-public__context-meta mono">REGISTRIERT</span>
        </header>

        <main className="shifts-public-wrap" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}>
          <div className="shifts-public__card" style={{ maxWidth: 520, width: '100%' }}>
            <div className="shifts-public__card-body" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1.25rem',
                background: 'color-mix(in oklab, var(--green-soft) 70%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle style={{ width: 28, height: 28, color: 'var(--green-ink)' }} />
              </div>
              <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
                {t('shifts.public.registrationSuccess')}
              </h2>
              <p style={{ color: 'var(--mute)', fontSize: 15, margin: 0 }}>{t('shifts.public.checkEmail')}</p>

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
                          background: 'var(--paper)',
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

        <footer className="shifts-public__footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dark.png" alt="OpenEOS" style={{ height: 22, width: 'auto', display: 'block' }} />
          <span>© {new Date().getFullYear()} OpenEOS</span>
        </footer>
      </>
    );
  }

  // ── Main page ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Logo bar */}
      <div className="shifts-public__logo-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dark.png" alt="OpenEOS" />
      </div>

      {/* Dark context strip */}
      <header className="shifts-public__context">
        <span className="shifts-public__context-label">
          <b>{plan.organization.name}</b> · Schichtplan
        </span>
        <span className="shifts-public__context-meta mono">
          {plan.event ? formatEventDates(plan.event.startDate, plan.event.endDate).toUpperCase() : 'OFFENE ANMELDUNG'}
        </span>
      </header>

      <main className="shifts-public-wrap" style={{ flex: 1, paddingBottom: step === 'select' ? 96 : 32 }}>
        {step === 'select' && (
          <>
            {/* Hero */}
            <section className="shifts-public__hero">
              <div className="shifts-public__hero-meta">
                {plan.organization.logoUrl ? (
                  <Image
                    src={plan.organization.logoUrl}
                    alt={plan.organization.name}
                    width={28}
                    height={28}
                    style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
                  />
                ) : (
                  <Building07 style={{ width: 18, height: 18, color: 'var(--green-ink)' }} />
                )}
                <b>{plan.organization.name}</b>
                {plan.event && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{plan.event.name}</span>
                  </>
                )}
              </div>
              <h1>{plan.name}</h1>
              {plan.description && (
                <p className="shifts-public__hero-desc">{plan.description}</p>
              )}

              <div className="shifts-public__info">
                {plan.settings.allowMultipleShifts
                  ? plan.settings.maxShiftsPerPerson
                    ? t('shifts.public.selectMultipleMax', { max: plan.settings.maxShiftsPerPerson })
                    : t('shifts.public.selectMultiple')
                  : t('shifts.public.selectOne')}
              </div>
            </section>

            {/* Toolbar */}
            <div className="shifts-public__toolbar">
              <span className="shifts-public__counter">
                {selectedShifts.size > 0 ? `${selectedShifts.size} ${t('shifts.public.selected')}` : ''}
              </span>
              <div className="shifts-public__view-toggle">
                {(['mobile', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={viewMode === mode ? 'is-active' : ''}
                  >
                    {mode === 'mobile'
                      ? <><Grid01 style={{ width: 14, height: 14 }} />Karten</>
                      : <><List style={{ width: 14, height: 14 }} />{t('shifts.public.listView')}</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile view — vertical stream of time-slot sections, each with a
                2-column grid of large job tap-targets. Avoids horizontal scroll
                that the matrix/calendar layouts force when there are many jobs. */}
            {viewMode === 'mobile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: '1.25rem' }}>
                {mobileGroups.length === 0 ? (
                  <div className="shifts-public__card" style={{ padding: 32, textAlign: 'center', color: 'var(--mute)', fontSize: 14 }}>
                    Keine Schichten vorhanden.
                  </div>
                ) : (
                  mobileGroups.map((group) => {
                    const dateObj = new Date(group.date);
                    const crossesMidnight = timeToMinutes(group.endTime) <= timeToMinutes(group.startTime);
                    return (
                      <section key={group.key} className="shifts-public__card" style={{ padding: 0, overflow: 'hidden' }}>
                        <header style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                          background: 'color-mix(in oklab, var(--ink) 3%, transparent)',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <Calendar style={{ width: 16, height: 16, color: 'var(--green-ink)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                              {dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                              <Clock style={{ width: 11, height: 11 }} />
                              {formatTime(group.startTime)} – {formatTime(group.endTime)}{crossesMidnight ? ' (am Folgetag)' : ''}
                            </div>
                          </div>
                        </header>

                        <div style={{
                          padding: 8,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                          gap: 8,
                        }}>
                          {group.shifts.map(({ job, shift }) => {
                            const isSelected = selectedShifts.has(shift.id);
                            const overlappingShift = !isSelected ? getOverlappingShift(shift) : null;
                            const hasOverlap = !!overlappingShift;
                            const isDisabled = shift.isFull || hasOverlap;

                            const cellBg = isSelected
                              ? 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))'
                              : shift.isFull
                              ? 'color-mix(in oklab, var(--ink) 8%, transparent)'
                              : hasOverlap
                              ? 'color-mix(in oklab, #f59e0b 10%, transparent)'
                              : 'var(--paper)';
                            const cellBorder = isSelected ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)';

                            return (
                              <button
                                key={shift.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => handleShiftToggle(shift.id, shift.isFull, hasOverlap)}
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                  justifyContent: 'space-between', gap: 6,
                                  padding: '12px 12px', borderRadius: 'var(--r-sm)',
                                  border: `1.5px solid ${cellBorder}`, background: cellBg,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isDisabled && !isSelected ? 0.6 : 1,
                                  fontFamily: 'inherit', transition: 'background .15s, border-color .15s',
                                  minHeight: 86, width: '100%', textAlign: 'left',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: job.color || '#6b7280', flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {job.name}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                  {isSelected ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green-ink)', fontSize: 12, fontWeight: 600 }}>
                                      <CheckCircle style={{ width: 14, height: 14 }} />
                                      {t('shifts.public.selected')}
                                    </span>
                                  ) : shift.isFull ? (
                                    <span className="badge badge--success" style={{ fontSize: 10 }}>{t('shifts.public.full')}</span>
                                  ) : hasOverlap ? (
                                    <span className="badge badge--warning" style={{ fontSize: 10 }}>{t('shifts.public.overlap')}</span>
                                  ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                                      <Users01 style={{ width: 12, height: 12, color: 'var(--mute)' }} />
                                      <span>{shift.availableSpots}</span>
                                      <span style={{ color: 'var(--mute)', fontWeight: 400 }}>/{shift.requiredWorkers} frei</span>
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div>
                {sortedDates.map((date) => (
                  <div key={date} className="shifts-public__day-card">
                    <div className="shifts-public__day-head">
                      <Calendar style={{ width: 16, height: 16, color: 'var(--green-ink)' }} />
                      <span>{formatDate(date)}</span>
                    </div>
                    <div>
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
                            className={`shifts-public__shift-row${isSelected ? ' is-selected' : ''}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              {/* Selection indicator */}
                              <div className="shifts-public__shift-checkbox">
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

            {/* Floating continue pill (only when shifts selected) */}
            {selectedShifts.size > 0 && (
              <div
                className="shifts-public__continue-pill"
                role="region"
                aria-label={t('shifts.public.continue')}
              >
                <span className="shifts-public__continue-pill-count">{selectedShifts.size}</span>
                <span className="shifts-public__continue-pill-label">
                  {selectedShifts.size === 1 ? 'Schicht ausgewählt' : 'Schichten ausgewählt'}
                </span>
                <button
                  type="button"
                  className="shifts-public__continue-pill-action"
                  onClick={() => setStep('form')}
                >
                  {t('shifts.public.continue')}
                </button>
              </div>
            )}
          </>
        )}

        {step === 'form' && (
          <div style={{ paddingTop: 24, paddingBottom: '2rem' }}>
            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep('select')}
              className="shifts-public__back"
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {t('shifts.public.backToSelection')}
            </button>

            <div className="shifts-public__card" style={{ marginTop: 12 }}>
              <div className="shifts-public__card-head">
                <h2 className="shifts-public__card-title">{t('shifts.public.yourDetails')}</h2>
              </div>
              <div className="shifts-public__card-body">
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
      <footer className="shifts-public__footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_dark.png" alt="OpenEOS" style={{ height: 22, width: 'auto', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>© {new Date().getFullYear()} OpenEOS</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="https://openeos.de/imprint" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Impressum</a>
        </div>
      </footer>
    </>
  );
}
