'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan } from '@/types/shift';

const formatTime = (t: string) => t.slice(0, 5);

interface Props {
  open: boolean;
  plan: ShiftPlan;
  onClose: () => void;
}

/** Admin-side helper add: pick any shift, enter contact details, create
 *  a directly-confirmed registration (no email verification round trip). */
export function ManualAddRegistrationModal({ open, plan, onClose }: Props) {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [shiftId, setShiftId] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flat list of selectable shifts, sorted by date+time.
  const allShifts = useMemo(() => {
    const out: Array<{ shiftId: string; jobId: string; jobName: string; jobColor: string | null; date: string; startTime: string; endTime: string; isFull: boolean; confirmedCount: number; requiredWorkers: number }> = [];
    for (const job of plan.jobs || []) {
      for (const shift of job.shifts || []) {
        const confirmed = shift.registrations?.filter((r) => r.status === 'confirmed').length || 0;
        out.push({
          shiftId: shift.id,
          jobId: job.id,
          jobName: job.name,
          jobColor: job.color || null,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isFull: confirmed >= shift.requiredWorkers,
          confirmedCount: confirmed,
          requiredWorkers: shift.requiredWorkers,
        });
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return out;
  }, [plan]);

  const mutation = useMutation({
    mutationFn: () =>
      shiftsApi.adminCreateRegistration(organizationId!, shiftId, {
        name,
        email,
        phone: phone || undefined,
        notes: notes || undefined,
        adminNotes: adminNotes || undefined,
        notify,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      reset();
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Speichern fehlgeschlagen'),
  });

  const reset = () => {
    setShiftId(''); setName(''); setEmail(''); setPhone('');
    setNotes(''); setAdminNotes(''); setNotify(false); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  const canSubmit = shiftId && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Helfer manuell eintragen</div>
          <button className="modal__close" onClick={handleClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>{error}</div>
            )}

            <div className="auth-field">
              <label className="auth-field__label">Schicht *</label>
              <select className="input" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                <option value="">— Schicht wählen —</option>
                {allShifts.map((s) => (
                  <option key={s.shiftId} value={s.shiftId} disabled={s.isFull}>
                    {s.jobName} — {formatDate(s.date)} {formatTime(s.startTime)}–{formatTime(s.endTime)} ({s.confirmedCount}/{s.requiredWorkers}){s.isFull ? ' — voll' : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>
                Volle Schichten sind deaktiviert — du kannst überschreiben, wenn nötig (z.B. Springer eintragen).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="auth-field">
                <label className="auth-field__label">Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">E-Mail *</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@example.com" />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Telefon (optional)</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Anmerkungen (vom Helfer)</label>
              <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Admin-Notizen (intern)</label>
              <textarea className="textarea" rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--green-ink)' }} />
              <span>Helfer per E-Mail benachrichtigen (Bestätigung mit Schicht-Übersicht)</span>
            </label>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={handleClose}>Abbrechen</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending ? '...' : 'Eintragen'}
          </button>
        </div>
      </div>
    </div>
  );
}
