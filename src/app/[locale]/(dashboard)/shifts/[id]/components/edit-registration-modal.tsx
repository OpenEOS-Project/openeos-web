'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftRegistration } from '@/types/shift';

const formatTime = (t: string) => t.slice(0, 5);

interface Props {
  open: boolean;
  plan: ShiftPlan;
  /** Any registration in the helper's group; the modal pulls all sibling
   *  shifts from that group via plan.jobs. */
  registration: ShiftRegistration | null;
  /** All registrations for the plan, used to resolve the helper's other shifts
   *  by registrationGroupId. */
  allRegistrations: ShiftRegistration[];
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

export function EditRegistrationModal({ open, plan, registration, allRegistrations, onClose }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  // Contact-detail fields (apply to the helper, not the individual shifts).
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Staged changes against the helper's current registrations.
  // Each existing reg row's shiftId is in `currentShiftIds`. The admin can
  // remove rows (regId in `removedRegIds`) and add new ones
  // (`addedShiftIds`). On Save we apply removes + adds in one go.
  const [removedRegIds, setRemovedRegIds] = useState<Set<string>>(new Set());
  const [addedShiftIds, setAddedShiftIds] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [shiftQuery, setShiftQuery] = useState('');
  // Optional note the admin can send along with the proposal email.
  const [proposalMessage, setProposalMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const groupRegs = useMemo(() => {
    if (!registration) return [] as ShiftRegistration[];
    // Helpers are grouped on the list page by email AND name (a person may
    // have submitted the public form multiple times = multiple
    // registrationGroupIds, while families often share one address), so the
    // edit modal operates on the same union: every registration with the
    // same email+name is considered the same helper's row.
    const helperKey = (r: ShiftRegistration) =>
      `${(r.email || '').trim().toLowerCase()}|${(r.name || '').trim().toLowerCase()}`;
    const key = helperKey(registration);
    return allRegistrations
      .filter((r) => helperKey(r) === key)
      .sort((a, b) => {
        const aDate = (a.shift?.date || '').localeCompare(b.shift?.date || '');
        if (aDate !== 0) return aDate;
        return (a.shift?.startTime || '').localeCompare(b.shift?.startTime || '');
      });
  }, [registration, allRegistrations]);

  // Flat catalogue of every shift in the plan for the picker.
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
    out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.jobName.localeCompare(b.jobName));
    return out;
  }, [plan]);

  // Group picker entries by date for a 2-column card layout.
  const pickerGroups = useMemo(() => {
    const map = new Map<string, ShiftCard[]>();
    for (const s of allShifts) {
      const arr = map.get(s.date) || [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return Array.from(map.entries()).map(([date, shifts]) => ({ date, shifts }));
  }, [allShifts]);

  // Free-text filter over job name, date and time so the (potentially long)
  // shift list stays manageable. Date groups with no match are dropped.
  const filteredGroups = useMemo(() => {
    const q = shiftQuery.trim().toLowerCase();
    if (!q) return pickerGroups;
    return pickerGroups
      .map(({ date, shifts }) => ({
        date,
        shifts: shifts.filter(
          (s) =>
            s.jobName.toLowerCase().includes(q) ||
            formatDate(s.date).toLowerCase().includes(q) ||
            `${formatTime(s.startTime)}–${formatTime(s.endTime)}`.includes(q),
        ),
      }))
      .filter((g) => g.shifts.length > 0);
  }, [pickerGroups, shiftQuery]);

  // Shift IDs the helper currently has assigned (post-staged-changes).
  const activeShiftIds = useMemo(() => {
    const ids = new Set<string>();
    for (const reg of groupRegs) {
      if (!removedRegIds.has(reg.id)) ids.add(reg.shiftId);
    }
    for (const id of addedShiftIds) ids.add(id);
    return ids;
  }, [groupRegs, removedRegIds, addedShiftIds]);

  useEffect(() => {
    if (!open || !registration) return;
    setName(registration.name);
    setEmail(registration.email || '');
    setPhone(registration.phone ?? '');
    setNotes(registration.notes ?? '');
    setAdminNotes(registration.adminNotes ?? '');
    setRemovedRegIds(new Set());
    setAddedShiftIds(new Set());
    setShowPicker(false);
    setShiftQuery('');
    setProposalMessage('');
    setError(null);
  }, [open, registration]);

  const hasShiftChanges = removedRegIds.size > 0 || addedShiftIds.size > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!registration) return;

      // 1. Update contact details on the FIRST surviving registration (covers
      //    all rows in the group, since they share fields by convention).
      const survivor = groupRegs.find((r) => !removedRegIds.has(r.id));
      if (survivor) {
        await shiftsApi.adminUpdateRegistration(organizationId!, survivor.id, {
          name,
          email: email.trim() || null,
          phone: phone || undefined,
          notes: notes || undefined,
          adminNotes: adminNotes || undefined,
        });
      }

      // 2. Mirror the contact details onto the OTHER surviving rows too so a
      //    later list query stays consistent.
      for (const reg of groupRegs) {
        if (reg.id === survivor?.id) continue;
        if (removedRegIds.has(reg.id)) continue;
        await shiftsApi.adminUpdateRegistration(organizationId!, reg.id, {
          name,
          email: email.trim() || null,
          phone: phone || undefined,
          notes: notes || undefined,
          adminNotes: adminNotes || undefined,
        });
      }

      // 3. Remove staged-removed rows.
      for (const regId of removedRegIds) {
        await shiftsApi.removeSingleRegistration(organizationId!, regId);
      }

      // 4. Append new shifts onto the helper's group.
      for (const shiftId of addedShiftIds) {
        await shiftsApi.adminCreateRegistration(organizationId!, shiftId, {
          name,
          email: email.trim() || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
          adminNotes: adminNotes || undefined,
          registrationGroupId: registration.registrationGroupId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || t('common.saveFailed')),
  });

  /** Same modal, but instead of applying the staged shift changes we package
   *  them into a proposal that the helper accepts or declines via email.
   *  Contact-detail edits still apply directly — those don't need approval. */
  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!registration) return;

      // 1. Patch contact details on every surviving row (silent).
      for (const reg of groupRegs) {
        await shiftsApi.adminUpdateRegistration(organizationId!, reg.id, {
          name,
          email: email.trim() || null,
          phone: phone || undefined,
          notes: notes || undefined,
          adminNotes: adminNotes || undefined,
        });
      }

      // 2. Build the ops list from the staged changes.
      const ops: Array<{ type: 'add'; shiftId: string } | { type: 'remove'; registrationId: string }> = [];
      for (const regId of removedRegIds) ops.push({ type: 'remove', registrationId: regId });
      for (const shiftId of addedShiftIds) ops.push({ type: 'add', shiftId });

      await shiftsApi.proposeRegistrationChanges(
        organizationId!,
        registration.registrationGroupId,
        { ops, message: proposalMessage || undefined },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, plan.id] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, plan.id] });
      onClose();
    },
    onError: (err: Error) => setError(err.message || 'Vorschlag konnte nicht gesendet werden'),
  });

  if (!open || !registration) return null;

  // Email is optional (manually added helpers may not have one) — but when
  // given it must be valid. Change proposals NEED an email, the helper has
  // to accept them via mail.
  const canSubmit = name.trim().length >= 2 && (!email.trim() || /\S+@\S+\.\S+/.test(email));
  const canPropose = canSubmit && !!email.trim();
  const addedShiftCards = allShifts.filter((s) => addedShiftIds.has(s.shiftId));

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__box" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__title">Anmeldung bearbeiten</div>
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* Helper details */}
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

            {/* Shifts list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Eingetragene Schichten</span>
                <span style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                  {groupRegs.length - removedRegIds.size + addedShiftIds.size} aktiv
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {groupRegs.map((reg) => {
                  const isRemoved = removedRegIds.has(reg.id);
                  return (
                    <div
                      key={reg.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 8,
                        border: `1px solid ${isRemoved ? 'color-mix(in oklab, var(--danger) 30%, transparent)' : 'color-mix(in oklab, var(--ink) 10%, transparent)'}`,
                        background: isRemoved ? 'color-mix(in oklab, var(--danger) 6%, transparent)' : 'var(--paper)',
                        opacity: isRemoved ? 0.6 : 1,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: reg.shift?.job?.color || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isRemoved ? 'color-mix(in oklab, var(--ink) 50%, transparent)' : 'var(--ink)', textDecoration: isRemoved ? 'line-through' : 'none' }}>
                          {reg.shift?.job?.name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                          {reg.shift ? formatDate(reg.shift.date) : ''} · {reg.shift ? `${formatTime(reg.shift.startTime)}–${formatTime(reg.shift.endTime)}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() =>
                          setRemovedRegIds((s) => {
                            const next = new Set(s);
                            if (next.has(reg.id)) next.delete(reg.id);
                            else next.add(reg.id);
                            return next;
                          })
                        }
                      >
                        {isRemoved ? 'Wiederherstellen' : 'Entfernen'}
                      </button>
                    </div>
                  );
                })}

                {addedShiftCards.map((s) => (
                  <div
                    key={`add-${s.shiftId}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      border: '1px solid color-mix(in oklab, var(--green-ink) 35%, transparent)',
                      background: 'color-mix(in oklab, var(--green-soft) 30%, var(--paper))',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.jobColor || '#6b7280', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.jobName}</div>
                      <div style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                        {formatDate(s.date)} · {formatTime(s.startTime)}–{formatTime(s.endTime)} · NEU
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setAddedShiftIds((set) => { const next = new Set(set); next.delete(s.shiftId); return next; })}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 12, alignSelf: 'flex-start' }}
                onClick={() => setShowPicker((v) => !v)}
              >
                {showPicker ? '× Picker schließen' : '+ Schicht hinzufügen'}
              </button>

              {hasShiftChanges && (
                <div className="auth-field" style={{ marginTop: 4 }}>
                  <label className="auth-field__label">Optionale Notiz für den Helfer (nur beim Vorschlag)</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="z.B. Wir bräuchten dich an einer anderen Stelle — passt das so?"
                    value={proposalMessage}
                    onChange={(e) => setProposalMessage(e.target.value)}
                  />
                  <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', marginTop: 4 }}>
                    Beim „Vorschlag senden" bekommt der Helfer eine Mail mit „Annehmen"/„Ablehnen"-Buttons. „Direkt speichern" wendet alles sofort an, ohne zu fragen.
                  </p>
                </div>
              )}

              {showPicker && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    className="input"
                    type="search"
                    placeholder="Schicht suchen (Arbeit, Datum, Uhrzeit)…"
                    value={shiftQuery}
                    onChange={(e) => setShiftQuery(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <div style={{ border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)', borderRadius: 8, padding: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {filteredGroups.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>
                        {shiftQuery.trim() ? 'Keine Schicht gefunden.' : 'Keine Schichten im Plan.'}
                      </div>
                    ) : (
                      filteredGroups.map(({ date, shifts }) => (
                        <div key={date} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '4px 6px' }}>
                            {formatDate(date)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {shifts.map((s) => {
                              const alreadyHas = activeShiftIds.has(s.shiftId);
                              // Full shifts stay selectable so admins can overbook
                              // (e.g. add a stand-in); only block re-adding a shift
                              // the helper already has.
                              const disabled = alreadyHas;
                              return (
                                <button
                                  key={s.shiftId}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setAddedShiftIds((set) => { const next = new Set(set); next.add(s.shiftId); return next; })}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                    textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                                    border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                                    background: alreadyHas
                                      ? 'color-mix(in oklab, var(--green-soft) 40%, var(--paper))'
                                      : s.isFull
                                      ? 'color-mix(in oklab, var(--ink) 6%, transparent)'
                                      : 'var(--paper)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.6 : 1,
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.jobColor || '#6b7280', flexShrink: 0 }} />
                                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.jobName}</span>
                                  <span style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 55%, transparent)', fontFamily: 'var(--f-mono)', flexShrink: 0 }}>
                                    {formatTime(s.startTime)}–{formatTime(s.endTime)}
                                  </span>
                                  <span style={{ fontSize: 10, flexShrink: 0, minWidth: 70, textAlign: 'right', color: alreadyHas ? 'var(--green-ink)' : s.isFull ? '#b45309' : 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>
                                    {alreadyHas ? '✓ dabei' : s.isFull ? `voll ${s.confirmedCount}/${s.requiredWorkers}` : `${s.confirmedCount}/${s.requiredWorkers}`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 50%, transparent)', margin: 0 }}>
                    Volle Schichten lassen sich trotzdem hinzufügen (z.B. Springer eintragen).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasShiftChanges && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canPropose || proposeMutation.isPending || mutation.isPending}
                onClick={() => { setError(null); proposeMutation.mutate(); }}
                title={!email.trim()
                  ? 'Vorschläge benötigen eine E-Mail-Adresse des Helfers'
                  : 'Helfer bekommt eine E-Mail mit Annehmen / Ablehnen — Änderung erst nach Bestätigung'}
              >
                {proposeMutation.isPending ? '...' : 'Vorschlag senden'}
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSubmit || mutation.isPending || proposeMutation.isPending}
              onClick={() => { setError(null); mutation.mutate(); }}
            >
              {mutation.isPending ? '...' : hasShiftChanges ? 'Direkt speichern' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
