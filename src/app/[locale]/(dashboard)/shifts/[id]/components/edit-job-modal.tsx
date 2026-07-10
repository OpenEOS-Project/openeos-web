'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { DialogCloseButton } from '@/components/shared/dialog-close-button';
import type { ShiftJob } from '@/types/shift';

interface Props {
  open: boolean;
  job: ShiftJob | null;
  planId: string;
  onClose: () => void;
}

/** Edit an existing job: name, description and the job-level default for
 *  required helpers per shift. Changing the job-level number does NOT
 *  rewrite existing shifts — those keep their per-shift values; only newly
 *  created shifts pick up the new default. */
export function EditJobModal({ open, job, planId, onClose }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiredWorkers, setRequiredWorkers] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;
    setName(job.name);
    setDescription(job.description ?? '');
    setRequiredWorkers(job.requiredWorkers ?? 1);
    setError(null);
  }, [open, job]);

  const mutation = useMutation({
    mutationFn: () =>
      shiftsApi.updateJob(organizationId!, job!.id, {
        name,
        description: description || undefined,
        requiredWorkers,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || t('common.saveFailed')),
  });

  if (!open || !job) return null;

  const canSubmit = name.trim().length >= 1 && requiredWorkers >= 1;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box modal__panel--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Arbeit bearbeiten</div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div role="alert" style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            <div className="auth-field">
              <label className="auth-field__label">Name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Beschreibung</label>
              <textarea className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Helfer pro Schicht *</label>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={String(requiredWorkers)}
                onChange={(e) => setRequiredWorkers(parseInt(e.target.value) || 1)}
              />
              <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>
                Wirkt sich auf neu erstellte Schichten aus. Bestehende Schichten behalten ihren Wert — diese können pro Schicht bearbeitet werden.
              </p>
            </div>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending ? t('common.saving') : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
