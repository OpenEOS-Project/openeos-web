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
  // Multi-line textarea — one job name per non-empty line.
  names: z
    .string()
    .min(1, 'Mindestens ein Name ist erforderlich')
    .refine(
      (v) => v.split('\n').map((s) => s.trim()).filter(Boolean).length > 0,
      'Mindestens ein Name ist erforderlich',
    ),
  description: z.string().optional(),
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

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { names: '', description: '' },
  });

  const namesPreview = watch('names')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const lines = data.names.split('\n').map((s) => s.trim()).filter(Boolean);
      // Create jobs sequentially so the sortOrder reflects input order
      // (a Promise.all race would leave them ordered by save-time).
      for (const name of lines) {
        await shiftsApi.createJob(organizationId!, planId, {
          name,
          description: data.description || undefined,
        });
      }
    },
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
                name="names"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.jobName')} *</label>
                    <textarea
                      className="textarea"
                      rows={5}
                      placeholder={`Zapfen${'\n'}Grill${'\n'}Kasse`}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                    <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 4 }}>
                      Pro Zeile eine Arbeit — alle werden gleichzeitig angelegt.
                    </p>
                    {errors.names && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.names.message}</p>}
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
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending || namesPreview.length === 0}>
              {createMutation.isPending
                ? '...'
                : namesPreview.length > 1
                ? `${namesPreview.length} Arbeiten anlegen`
                : t('shifts.editor.addJob')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
