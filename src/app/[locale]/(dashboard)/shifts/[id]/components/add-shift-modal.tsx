'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';

const schema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  startTime: z.string().min(1, 'Startzeit ist erforderlich'),
  endTime: z.string().min(1, 'Endzeit ist erforderlich'),
  requiredWorkers: z.number().min(1, 'Mindestens 1 Helfer erforderlich'),
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

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', startTime: '10:00', endTime: '14:00', requiredWorkers: 2 },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createShift(organizationId!, jobId!, {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        requiredWorkers: data.requiredWorkers,
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
      <div className="modal__box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.editor.addShift')}</div>
          <button className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>{error}</div>
              )}

              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.shiftDate')} *</label>
                    <input className="input" type="date" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    {errors.date && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.date.message}</p>}
                  </div>
                )}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <div className="auth-field">
                      <label className="auth-field__label">{t('shifts.editor.shiftStartTime')} *</label>
                      <input className="input" type="time" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      {errors.startTime && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.startTime.message}</p>}
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
                      {errors.endTime && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.endTime.message}</p>}
                    </div>
                  )}
                />
              </div>

              <Controller
                name="requiredWorkers"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.requiredWorkers')} *</label>
                    <input
                      className="input"
                      type="number"
                      value={String(field.value)}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      onBlur={field.onBlur}
                    />
                    {errors.requiredWorkers && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.requiredWorkers.message}</p>}
                  </div>
                )}
              />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? '...' : t('shifts.editor.addShift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
