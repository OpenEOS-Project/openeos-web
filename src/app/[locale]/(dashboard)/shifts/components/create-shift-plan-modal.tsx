'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi, eventsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan } from '@/types/shift';

const schema = z.object({
  eventId: z.string().optional(),
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateShiftPlanModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: ShiftPlan) => void;
}

const STEP_LABELS = ['Event', 'Name & Beschreibung', 'Erstellen'];

export function CreateShiftPlanModal({ open, onClose, onCreated }: CreateShiftPlanModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const { data: eventsData } = useQuery({
    queryKey: ['events', organizationId],
    queryFn: () => eventsApi.list(organizationId!),
    enabled: !!organizationId && open,
  });

  const events = eventsData?.data || [];
  const activeEvents = events.filter((e) => e.status === 'active' || e.status === 'test');

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { eventId: '', name: '', description: '' },
  });

  const selectedEventId = watch('eventId');
  const currentName = watch('name');
  const currentDescription = watch('description');
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const handleEventSelect = (eventId: string) => {
    setValue('eventId', eventId);
    if (eventId && !currentName) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        setValue('name', `${t('shifts.helperPlan')} ${event.name}`);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createPlan(organizationId!, {
        name: data.name,
        description: data.description || undefined,
        eventId: data.eventId || undefined,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
      reset();
      setStep(0);
      onCreated(response.data);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const onSubmit = (data: FormData) => {
    // Only the Erstellen-button on the final step should actually submit.
    // Implicit Enter-key submissions on earlier steps are forwarded to handleNext.
    if (step !== STEP_LABELS.length - 1) {
      void handleNext();
      return;
    }
    setError(null);
    createMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setError(null);
    setStep(0);
    onClose();
  };

  const handleNext = async () => {
    if (step === 1) {
      const ok = await trigger(['name']);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  if (!open) return null;

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.createPlan')}</div>
          <button type="button" className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)', fontSize: 12 }}>
          {STEP_LABELS.map((label, idx) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: idx <= step ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)',
                  color: idx <= step ? 'var(--paper)' : 'color-mix(in oklab, var(--ink) 50%, transparent)',
                  fontWeight: 700, fontSize: 11,
                }}
              >
                {idx + 1}
              </span>
              <span style={{ fontWeight: idx === step ? 600 : 400, color: idx === step ? 'var(--ink)' : 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <span style={{ width: 16, height: 1, background: 'color-mix(in oklab, var(--ink) 12%, transparent)', marginLeft: 4 }} />
              )}
            </span>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {step === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                    Wähle (optional) ein Event aus, zu dem dieser Schichtplan gehört. So bekommen die Helfer das Event-Datum direkt angezeigt.
                  </p>
                  {activeEvents.length === 0 ? (
                    <div style={{ padding: 14, borderRadius: 8, background: 'color-mix(in oklab, var(--ink) 5%, transparent)', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)' }}>
                      Kein aktives Event vorhanden — du kannst den Plan auch ohne Event erstellen.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label
                        key="none"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                          padding: '10px 12px', borderRadius: 8,
                          border: `1px solid ${selectedEventId === '' ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)'}`,
                          background: selectedEventId === '' ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))' : 'var(--paper)',
                        }}
                      >
                        <input
                          type="radio"
                          name="event"
                          checked={selectedEventId === ''}
                          onChange={() => handleEventSelect('')}
                          style={{ accentColor: 'var(--green-ink)' }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Kein Event (eigenständiger Plan)</span>
                      </label>
                      {activeEvents.map((event) => (
                        <label
                          key={event.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            padding: '10px 12px', borderRadius: 8,
                            border: `1px solid ${selectedEventId === event.id ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 12%, transparent)'}`,
                            background: selectedEventId === event.id ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))' : 'var(--paper)',
                          }}
                        >
                          <input
                            type="radio"
                            name="event"
                            checked={selectedEventId === event.id}
                            onChange={() => handleEventSelect(event.id)}
                            style={{ accentColor: 'var(--green-ink)' }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{event.name}</div>
                            {event.startDate && (
                              <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                                {formatDate(event.startDate)}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <div className="auth-field">
                        <label className="auth-field__label">{t('shifts.form.name')} *</label>
                        <input
                          className={`input${errors.name ? ' input--error' : ''}`}
                          placeholder={t('shifts.form.namePlaceholder')}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          autoFocus
                        />
                        {errors.name && (
                          <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.name.message}</p>
                        )}
                      </div>
                    )}
                  />

                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <div className="auth-field">
                        <label className="auth-field__label">{t('shifts.form.description')}</label>
                        <textarea
                          className="textarea"
                          rows={3}
                          placeholder={t('shifts.form.descriptionPlaceholder')}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                </div>
              )}

              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', margin: 0 }}>
                    Bitte prüfe deine Eingaben:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 8, border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', background: 'color-mix(in oklab, var(--ink) 3%, transparent)' }}>
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'color-mix(in oklab, var(--ink) 50%, transparent)', fontFamily: 'var(--f-mono)' }}>Event</div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {selectedEvent ? selectedEvent.name : <span style={{ color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>Kein Event</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'color-mix(in oklab, var(--ink) 50%, transparent)', fontFamily: 'var(--f-mono)' }}>{t('shifts.form.name')}</div>
                      <div style={{ fontSize: 14, marginTop: 2, fontWeight: 600 }}>{currentName || '—'}</div>
                    </div>
                    {currentDescription && (
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'color-mix(in oklab, var(--ink) 50%, transparent)', fontFamily: 'var(--f-mono)' }}>{t('shifts.form.description')}</div>
                        <div style={{ fontSize: 14, marginTop: 2, color: 'color-mix(in oklab, var(--ink) 75%, transparent)' }}>{currentDescription}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal__foot" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              Zurück
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--ghost" onClick={handleClose}>
                {t('common.cancel')}
              </button>
              {!isLastStep ? (
                <button type="button" className="btn btn--primary" onClick={handleNext}>
                  Weiter
                </button>
              ) : (
                <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? '...' : t('shifts.createPlan')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
