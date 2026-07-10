'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { Shift } from '@/types/shift';

interface Props {
  open: boolean;
  shift: Shift | null;
  planId: string;
  onClose: () => void;
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Edit a single shift: date, start/end time (overnight allowed), required workers. */
export function EditShiftModal({ open, shift, planId, onClose }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shift) return;
    // shift.date may be a Date-string with time component; keep YYYY-MM-DD.
    setDate(typeof shift.date === 'string' ? shift.date.slice(0, 10) : '');
    setStartTime((shift.startTime || '10:00').slice(0, 5));
    setEndTime((shift.endTime || '14:00').slice(0, 5));
    setNotes(shift.notes ?? '');
    setError(null);
  }, [open, shift]);

  const isOvernight = timeToMinutes(endTime) <= timeToMinutes(startTime);

  const mutation = useMutation({
    mutationFn: () =>
      shiftsApi.updateShift(organizationId!, shift!.id, {
        date,
        startTime,
        endTime,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || t('common.saveFailed')),
  });

  if (!open || !shift) return null;

  const canSubmit = date && startTime !== endTime;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Schicht bearbeiten</div>
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            <div className="auth-field">
              <label className="auth-field__label">Datum *</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {isOvernight && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--warn) 12%, transparent)', color: '#b45309', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🌙</span>
                <span>Endzeit liegt vor Startzeit — die Schicht endet am Folgetag.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="auth-field">
                <label className="auth-field__label">Startzeit *</label>
                <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">Endzeit *</label>
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
              Die Anzahl der Helfer wird auf Arbeit-Ebene festgelegt — alle Schichten dieser Arbeit teilen sich diesen Wert.
            </p>

            <div className="auth-field">
              <label className="auth-field__label">Interne Notizen</label>
              <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            {mutation.isPending ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
