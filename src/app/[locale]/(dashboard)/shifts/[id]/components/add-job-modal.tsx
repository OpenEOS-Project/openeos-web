'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const schema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddJobModalProps {
  open: boolean;
  planId: string;
  onClose: () => void;
}

export function AddJobModal({ open, planId, onClose }: AddJobModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', color: COLORS[0] },
  });

  const selectedColor = watch('color');

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createJob(organizationId!, planId, {
        name: data.name,
        description: data.description || undefined,
        color: data.color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      reset();
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Ein Fehler ist aufgetreten'),
  });

  const onSubmit = (data: FormData) => { setError(null); createMutation.mutate(data); };
  const handleClose = () => { reset(); setError(null); onClose(); };

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.editor.addJob')}</div>
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
                name="name"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.jobName')} *</label>
                    <input className="input" placeholder={t('shifts.editor.jobNamePlaceholder')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    {errors.name && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.name.message}</p>}
                  </div>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.form.description')}</label>
                    <textarea className="textarea" rows={2} placeholder={t('shifts.form.descriptionPlaceholder')} value={field.value} onChange={field.onChange} />
                  </div>
                )}
              />

              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('shifts.editor.jobColor')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue('color', color)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: color,
                        outline: selectedColor === color ? `3px solid ${color}` : 'none',
                        outlineOffset: 2,
                        transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? '...' : t('shifts.editor.addJob')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
