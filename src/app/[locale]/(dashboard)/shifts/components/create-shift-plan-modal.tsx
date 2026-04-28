'use client';

import { useState } from 'react';
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

export function CreateShiftPlanModal({ open, onClose, onCreated }: CreateShiftPlanModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { eventId: '', name: '', description: '' },
  });

  const selectedEventId = watch('eventId');
  const currentName = watch('name');

  const handleEventChange = (eventId: string) => {
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
      onCreated(response.data);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const onSubmit = (data: FormData) => {
    setError(null);
    createMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.createPlan')}</div>
          <button className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {activeEvents.length > 0 && (
                <div className="auth-field">
                  <label className="auth-field__label">{t('shifts.form.event')}</label>
                  <select
                    className="select"
                    value={selectedEventId || ''}
                    onChange={(e) => handleEventChange(e.target.value)}
                  >
                    <option value="">{t('shifts.form.eventPlaceholder')}</option>
                    {activeEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}{event.startDate ? ` (${formatDate(event.startDate)})` : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginTop: 4 }}>
                    {t('shifts.form.eventHint')}
                  </p>
                </div>
              )}

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
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? '...' : t('shifts.createPlan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
