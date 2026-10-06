'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';

function createJobSchema(t: (key: string) => string) {
  return z.object({
    // Multi-line textarea — one job name per non-empty line.
    names: z
      .string()
      .min(1, t('jobNameRequired'))
      .refine(
        (v) => v.split('\n').map((s) => s.trim()).filter(Boolean).length > 0,
        t('jobNameRequired'),
      ),
    description: z.string().optional(),
    requiredWorkers: z.number().int().min(1).max(50),
  });
}

type FormData = z.infer<ReturnType<typeof createJobSchema>>;

interface AddJobModalProps {
  open: boolean;
  planId: string;
  onClose: () => void;
}

export function AddJobModal({ open, planId, onClose }: AddJobModalProps) {
  const t = useTranslations();
  const tValidation = useTranslations('shifts.validation');
  const apiErrorMessage = useApiErrorMessage();
  const schema = useMemo(() => createJobSchema(tValidation), [tValidation]);
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { names: '', description: '', requiredWorkers: 2 },
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
          requiredWorkers: data.requiredWorkers,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      reset();
      onClose();
    },
    onError: (err: Error) => setError(apiErrorMessage(err, t('common.error'))),
  });

  const onSubmit = (data: FormData) => { setError(null); createMutation.mutate(data); };
  const handleClose = () => { reset(); setError(null); onClose(); };

  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">{t('shifts.editor.addJob')}</div>
          <DialogCloseButton onClick={handleClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div role="alert" style={{ padding: 12, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
              )}

              <Controller
                name="names"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.editor.jobName')} <span className="auth-field__req">*</span></label>
                    <textarea
                      className="textarea"
                      rows={5}
                      placeholder={t('shifts.jobForm.namesPlaceholder')}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                    <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', marginTop: 4 }}>
                      {t('shifts.jobForm.namesHint')}
                    </p>
                    {errors.names && <p className="auth-field__error">{errors.names.message}</p>}
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

              <Controller
                name="requiredWorkers"
                control={control}
                render={({ field }) => (
                  <div className="auth-field">
                    <label className="auth-field__label">{t('shifts.jobForm.workersPerShift')} <span className="auth-field__req">*</span></label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={50}
                      value={String(field.value)}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                    <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>
                      {t('shifts.jobForm.workersDefaultHint')}
                    </p>
                  </div>
                )}
              />
            </div>
          </div>

          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending || namesPreview.length === 0}>
              {createMutation.isPending
                ? t('common.saving')
                : namesPreview.length > 1
                ? t('shifts.jobForm.createMany', { count: namesPreview.length })
                : t('shifts.editor.addJob')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
