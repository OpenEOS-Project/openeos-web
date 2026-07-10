'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';

const schema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  startTime: z.string().min(1, 'Startzeit ist erforderlich'),
  endTime: z.string().min(1, 'Endzeit ist erforderlich'),
});

type FormData = z.infer<typeof schema>;

interface AddShiftModalProps {
  open: boolean;
  jobId: string | null;
  planId: string;
  onClose: () => void;
}

export function AddShiftModal({ open, jobId, planId, onClose }: AddShiftModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', startTime: '10:00', endTime: '14:00' },
  });

  // Overnight shifts: when end < start, the shift crosses midnight (e.g. 22:00–01:00).
  // The DB stores only start/end times (not a real interval), so the server treats them
  // as-is and the consumer interprets end < start as "next day".
  const watchedStart = watch('startTime');
  const watchedEnd = watch('endTime');
  const isOvernight = (() => {
    if (!watchedStart || !watchedEnd) return false;
    const [sh, sm] = watchedStart.split(':').map(Number);
    const [eh, em] = watchedEnd.split(':').map(Number);
    return eh * 60 + em < sh * 60 + sm;
  })();

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createShift(organizationId!, jobId!, {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      reset();
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Ein Fehler ist aufgetreten'),
  });

  const onSubmit = (data: FormData) => { if (!jobId) return; setError(null); createMutation.mutate(data); };
  const handleClose = () => { reset(); setError(null); onClose(); };

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.editor.addShift')}</div>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div role="alert" style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
              )}

              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.shiftDate')} *</label>
                    <input className="input" type="date" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    {errors.date && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.date.message}</p>}
                  </div>
                )}
              />

              {isOvernight && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--warn) 12%, transparent)', color: '#b45309', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🌙</span>
                  <span>Endzeit liegt vor Startzeit — die Schicht endet am Folgetag.</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <div className="auth-field">
                      <label className="auth-field__label">{t('shifts.editor.shiftStartTime')} *</label>
                      <input className="input" type="time" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      {errors.startTime && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.startTime.message}</p>}
                    </div>
                  )}
                />
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <div className="auth-field">
                      <label className="auth-field__label">{t('shifts.editor.shiftEndTime')} *</label>
                      <input className="input" type="time" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      {errors.endTime && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.endTime.message}</p>}
                    </div>
                  )}
                />
              </div>

              <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                Die Anzahl der Helfer wird auf Arbeit-Ebene festgelegt — neue Schichten übernehmen diesen Wert automatisch.
              </p>
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.saving') : t('shifts.editor.addShift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
