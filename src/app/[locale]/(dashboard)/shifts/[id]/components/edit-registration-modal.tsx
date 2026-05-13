'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftRegistration } from '@/types/shift';

const formatTime = (t: string) => t.slice(0, 5);

interface Props {
  open: boolean;
  plan: ShiftPlan;
  registration: ShiftRegistration | null;
  onClose: () => void;
}

/** Edit a registration's contact details and/or move it to another shift.
 *  When the shift changes, the helper is notified by default. */
export function EditRegistrationModal({ open, plan, registration, onClose }: Props) {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [shiftId, setShiftId] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hydrate form when a registration is selected.
  useEffect(() => {
    if (!open || !registration) return;
    setShiftId(registration.shiftId);
    setName(registration.name);
    setEmail(registration.email);
    setPhone(registration.phone ?? '');
    setNotes(registration.notes ?? '');
    setAdminNotes(registration.adminNotes ?? '');
    setNotify(true);
    setNotifyMessage('');
    setError(null);
  }, [open, registration]);

  const allShifts = useMemo(() => {
    const out: Array<{ shiftId: string; jobName: string; date: string; startTime: string; endTime: string; isFull: boolean; confirmedCount: number; requiredWorkers: number }> = [];
    for (const job of plan.jobs || []) {
      for (const shift of job.shifts || []) {
        const confirmed = shift.registrations?.filter((r) => r.status === 'confirmed').length || 0;
        out.push({
          shiftId: shift.id,
          jobName: job.name,
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

  const shiftIsBeingMoved = registration && shiftId !== registration.shiftId;
  const [moveMode, setMoveMode] = useState<'direct' | 'propose'>('propose');

  const mutation = useMutation({
    mutationFn: async () => {
      // Always persist the contact-detail edits via the normal update path,
      // but DON'T pass shiftId if we're going to propose it (the proposal
      // endpoint handles the move separately).
      const reg = await shiftsApi.adminUpdateRegistration(organizationId!, registration!.id, {
        name,
        email,
        phone: phone || undefined,
        notes: notes || undefined,
        adminNotes: adminNotes || undefined,
        shiftId: shiftIsBeingMoved && moveMode === 'direct' ? shiftId : undefined,
        notify: shiftIsBeingMoved && moveMode === 'direct' ? notify : false,
        notifyMessage: shiftIsBeingMoved && moveMode === 'direct' && notifyMessage
          ? notifyMessage
          : undefined,
      });

      if (shiftIsBeingMoved && moveMode === 'propose') {
        await shiftsApi.proposeShiftMove(organizationId!, registration!.id, {
          shiftId,
          message: notifyMessage || undefined,
        });
      }
      return reg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Speichern fehlgeschlagen'),
  });

  if (!open || !registration) return null;

  const canSubmit = shiftId && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Anmeldung bearbeiten</div>
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
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
                {allShifts.map((s) => (
                  <option key={s.shiftId} value={s.shiftId} disabled={s.isFull && s.shiftId !== registration.shiftId}>
                    {s.jobName} — {formatDate(s.date)} {formatTime(s.startTime)}–{formatTime(s.endTime)} ({s.confirmedCount}/{s.requiredWorkers}){s.isFull ? ' — voll' : ''}
                  </option>
                ))}
              </select>
              {shiftIsBeingMoved && (
                <p style={{ fontSize: 12, color: '#b45309', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'color-mix(in oklab, #f59e0b 10%, transparent)' }}>
                  Schicht wird verschoben. Der Helfer wird per E-Mail über die Änderung informiert (sofern „benachrichtigen" aktiv ist).
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="auth-field">
                <label className="auth-field__label">Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">E-Mail *</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field__label">Telefon</label>
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

            {shiftIsBeingMoved && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 8, background: 'color-mix(in oklab, #f59e0b 8%, transparent)', border: '1px solid color-mix(in oklab, #f59e0b 25%, transparent)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b45309' }}>Schicht wird verschoben — wie soll der Helfer reagieren?</div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="moveMode"
                    checked={moveMode === 'propose'}
                    onChange={() => setMoveMode('propose')}
                    style={{ accentColor: 'var(--green-ink)', marginTop: 2 }}
                  />
                  <span>
                    <strong>Vorschlag schicken</strong> — der Helfer bekommt eine Mail mit „Annehmen"/„Ablehnen"-Buttons. Erst nach Bestätigung wird verschoben.
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="moveMode"
                    checked={moveMode === 'direct'}
                    onChange={() => setMoveMode('direct')}
                    style={{ accentColor: 'var(--green-ink)', marginTop: 2 }}
                  />
                  <span>
                    <strong>Direkt verschieben</strong> — die Schicht wird sofort geändert. Helfer kann optional benachrichtigt werden.
                  </span>
                </label>

                {moveMode === 'direct' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)', marginLeft: 22 }}>
                    <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--green-ink)' }} />
                    <span>Helfer per E-Mail informieren</span>
                  </label>
                )}

                {(moveMode === 'propose' || (moveMode === 'direct' && notify)) && (
                  <div className="auth-field" style={{ marginLeft: 22 }}>
                    <label className="auth-field__label">Optionale Notiz für den Helfer</label>
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="z.B. Grund der Verschiebung."
                      value={notifyMessage}
                      onChange={(e) => setNotifyMessage(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Abbrechen</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => { setError(null); mutation.mutate(); }}
          >
            {mutation.isPending
              ? '...'
              : shiftIsBeingMoved && moveMode === 'propose'
              ? 'Vorschlag senden'
              : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
