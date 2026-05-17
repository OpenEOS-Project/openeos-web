'use client';

import { useEffect, useMemo, useState } from 'react';
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

interface ShiftCard {
  shiftId: string;
  jobId: string;
  jobName: string;
  jobColor: string | null;
  date: string;
  startTime: string;
  endTime: string;
  isFull: boolean;
  confirmedCount: number;
  requiredWorkers: number;
}

/** Admin-side helper add: pick one OR MANY shifts via the inline card picker,
 *  enter contact details once, all selected shifts get created with the same
 *  registrationGroupId so the helper shows up as a single entry with several
 *  shifts. */
export function ManualAddRegistrationModal({ open, plan, onClose }: Props) {
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flat catalogue of every shift in the plan, with current occupancy info.
  const allShifts: ShiftCard[] = useMemo(() => {
    const out: ShiftCard[] = [];
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
    out.sort((a, b) =>
      a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.jobName.localeCompare(b.jobName),
    );
    return out;
  }, [plan]);

  const pickerGroups = useMemo(() => {
    const map = new Map<string, ShiftCard[]>();
    for (const s of allShifts) {
      const arr = map.get(s.date) || [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return Array.from(map.entries()).map(([date, shifts]) => ({ date, shifts }));
  }, [allShifts]);

  const selectedShiftCards = allShifts.filter((s) => selectedShiftIds.has(s.shiftId));

  useEffect(() => {
    if (!open) return;
    setSelectedShiftIds(new Set());
    setName(''); setEmail(''); setPhone(''); setNotes(''); setAdminNotes('');
    setNotify(false); setError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedShiftIds.size) return;
      // All shifts share the same group so the helper shows up as a single
      // entry with multiple sub-rows in the registrations list. We pass the
      // group id explicitly on every call past the first by reusing the
      // server-side group from the first response.
      let sharedGroupId: string | undefined;
      let first = true;
      for (const shiftId of selectedShiftIds) {
        const res = await shiftsApi.adminCreateRegistration(organizationId!, shiftId, {
          name,
          email,
          phone: phone || undefined,
          notes: notes || undefined,
          adminNotes: adminNotes || undefined,
          // Only the FIRST registration may trigger a notification email so
          // the helper gets one summary, not N copies.
          notify: first ? notify : false,
          registrationGroupId: sharedGroupId,
        });
        if (first) sharedGroupId = res.data.registrationGroupId;
        first = false;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Speichern fehlgeschlagen'),
  });

  const handleClose = () => onClose();
  if (!open) return null;

  const canSubmit = selectedShiftIds.size > 0 && name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);

  return (
    <div className="modal__backdrop" onClick={handleClose}>
      <div className="modal__box" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="auth-field">
                <label className="auth-field__label">Anmerkungen (vom Helfer)</label>
                <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">Admin-Notizen</label>
                <textarea className="textarea" rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Schichten auswählen *</span>
                <span style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                  {selectedShiftIds.size} {selectedShiftIds.size === 1 ? 'Schicht' : 'Schichten'} gewählt
                </span>
              </div>

              {selectedShiftCards.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {selectedShiftCards.map((s) => (
                    <div
                      key={`sel-${s.shiftId}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 10px', borderRadius: 6,
                        border: '1px solid color-mix(in oklab, var(--green-ink) 35%, transparent)',
                        background: 'color-mix(in oklab, var(--green-soft) 30%, var(--paper))',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.jobColor || '#6b7280', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>{s.jobName}</strong> · {formatDate(s.date)} · {formatTime(s.startTime)}–{formatTime(s.endTime)}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => setSelectedShiftIds((set) => { const next = new Set(set); next.delete(s.shiftId); return next; })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 8, padding: 8, maxHeight: 280, overflowY: 'auto' }}>
                {pickerGroups.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                    Keine Schichten im Plan.
                  </div>
                ) : (
                  pickerGroups.map(({ date, shifts }) => (
                    <div key={date} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '4px 6px' }}>
                        {formatDate(date)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                        {shifts.map((s) => {
                          const isSelected = selectedShiftIds.has(s.shiftId);
                          return (
                            <button
                              key={s.shiftId}
                              type="button"
                              onClick={() => setSelectedShiftIds((set) => {
                                const next = new Set(set);
                                if (next.has(s.shiftId)) next.delete(s.shiftId);
                                else next.add(s.shiftId);
                                return next;
                              })}
                              style={{
                                textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                                border: `1.5px solid ${isSelected ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 10%, transparent)'}`,
                                background: isSelected
                                  ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))'
                                  : s.isFull
                                  ? 'color-mix(in oklab, var(--ink) 6%, transparent)'
                                  : 'var(--paper)',
                                cursor: 'pointer',
                                opacity: !isSelected && s.isFull ? 0.7 : 1,
                                fontFamily: 'inherit',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.jobColor || '#6b7280', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.jobName}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontFamily: 'var(--f-mono)' }}>
                                {formatTime(s.startTime)}–{formatTime(s.endTime)}
                              </div>
                              <div style={{ fontSize: 10, marginTop: 2, color: isSelected ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                                {isSelected ? '✓ ausgewählt' : s.isFull ? `Voll (${s.confirmedCount}/${s.requiredWorkers})` : `${s.confirmedCount}/${s.requiredWorkers} belegt`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: 0 }}>
                Volle Schichten lassen sich trotzdem auswählen (z.B. Springer eintragen).
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--green-ink)' }} />
              <span>Helfer per E-Mail benachrichtigen (eine Sammel-Bestätigung)</span>
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
            {mutation.isPending
              ? '...'
              : selectedShiftIds.size > 1
              ? `${selectedShiftIds.size} Schichten eintragen`
              : 'Eintragen'}
          </button>
        </div>
      </div>
    </div>
  );
}
