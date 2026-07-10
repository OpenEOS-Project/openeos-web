'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { ShiftPlan, ShiftRegistration, ShiftRegistrationStatus } from '@/types/shift';
import { SendMessageModal } from './send-message-modal';
import { ManualAddRegistrationModal } from './manual-add-registration-modal';
import { EditRegistrationModal } from './edit-registration-modal';
import { Edit01, Trash01, UserPlus01, Mail01, CheckCircle, AlertCircle, Clock } from '@untitledui/icons';

/** Handover overlap tolerance in minutes — has to match the value in
 *  /s/[slug]/page.tsx so the admin and the public-side see overlaps
 *  consistently. A pair of shifts only counts as overlapping when the
 *  intersection lasts longer than this. */
const HANDOVER_TOLERANCE_MINUTES = 45;

/** Convert a (date YYYY-MM-DD, HH:mm start, HH:mm end) to absolute minutes
 *  since epoch — overnight shifts push their end into the next day so the
 *  interval is monotonic. */
function shiftBoundsInMinutes(date: string, startTime: string, endTime: string): [number, number] {
  const day = Math.floor(new Date(date).getTime() / 86_400_000);
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 1440;
  return [day * 1440 + startMins, day * 1440 + endMins];
}

const iconBtnStyle = (variant: 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
  padding: 6,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Skip the color for 'ghost' so .btn--primary's color: var(--paper) wins
  // when this helper is combined with that class — otherwise the icon ends
  // up dark-on-dark on the primary buttons.
  ...(variant === 'danger' ? { color: 'var(--red, var(--danger))' } : {}),
});

const formatTime = (time: string): string => {
  const parts = time.split(':');
  return `${parts[0]}:${parts[1]}`;
};

const statusBadge: Record<ShiftRegistrationStatus, string> = {
  pending_email: 'badge badge--neutral',
  pending_approval: 'badge badge--warning',
  confirmed: 'badge badge--success',
  rejected: 'badge badge--error',
  cancelled: 'badge badge--neutral',
};

interface RegistrationsListProps {
  plan: ShiftPlan;
}

export function RegistrationsList({ plan }: RegistrationsListProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const planId = plan.id;

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  // null = broadcast to all helpers; otherwise the single helper to message.
  const [messageHelper, setMessageHelper] = useState<{ name: string; email: string | null } | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<ShiftRegistration | null>(null);
  // Helper-level filter applied to the merged-by-email cards: 'all' shows
  // everyone, otherwise we only render helpers whose rows include at least
  // one shift in the matching state.
  type Filter = 'all' | 'unconfirmed' | 'pending_email' | 'pending_approval' | 'confirmed';
  const [filter, setFilter] = useState<Filter>('all');

  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['shift-registrations', organizationId, planId],
    queryFn: () => shiftsApi.listRegistrations(organizationId!, planId),
    enabled: !!organizationId && !!planId,
  });

  // Each helper card may span multiple `registrationGroupId`s (a person
  // submitted the public form twice). The mutations below accept an array
  // of registration ids (one representative per group) and loop, so the
  // action is applied to ALL of the helper's submissions rather than just
  // the one referenced by the card's first reg.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
    queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
  };
  const approveMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      for (const id of registrationIds) await shiftsApi.approveRegistration(organizationId!, id);
    },
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      for (const id of registrationIds) await shiftsApi.rejectRegistration(organizationId!, id);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      for (const id of registrationIds) await shiftsApi.deleteRegistration(organizationId!, id);
    },
    onSuccess: invalidate,
  });

  const verifyMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      for (const id of registrationIds) await shiftsApi.markRegistrationVerified(organizationId!, id);
    },
    onSuccess: invalidate,
  });

  /** Remove a single shift row from the helper's signup, leaving the rest
   *  of their shifts intact (vs. deleteMutation which is group-wide). */
  const removeShiftMutation = useMutation({
    mutationFn: (registrationId: string) =>
      shiftsApi.removeSingleRegistration(organizationId!, registrationId),
    onSuccess: invalidate,
  });

  const registrations = registrationsData?.data || [];

  // Distinct helper emails (lowercased) — drives the recipient count for the
  // "send to all" broadcast.
  const allHelperEmails = Array.from(
    new Set(
      registrations
        .map((r) => (r.email || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  // Group helpers by email AND name (case-insensitive) so a person who
  // signed up multiple times shows up as ONE card with all their shifts
  // merged. Email alone is not enough: families/groups often share one
  // address, so the name is part of the key — and helpers added manually
  // without an email group by their name.
  const helperKey = (reg: ShiftRegistration) =>
    `${(reg.email || '').trim().toLowerCase()}|${(reg.name || '').trim().toLowerCase()}`;

  const helperGroups = registrations.reduce((acc, reg) => {
    const key = helperKey(reg);
    if (!acc[key]) acc[key] = [];
    acc[key].push(reg);
    return acc;
  }, {} as Record<string, ShiftRegistration[]>);

  const allGroups = Object.values(helperGroups)
    .map((rows) =>
      rows.slice().sort((a, b) => {
        // Inside a helper-card, sort shifts chronologically by shift date+time.
        const ad = (a.shift?.date || '').localeCompare(b.shift?.date || '');
        if (ad !== 0) return ad;
        return (a.shift?.startTime || '').localeCompare(b.shift?.startTime || '');
      }),
    )
    .sort((a, b) => {
      // Sort cards by helper name so the list is stable and easy to scan.
      return (a[0].name || '').localeCompare(b[0].name || '');
    });

  // Status-filter applied at the helper-card level: a card matches a filter
  // when AT LEAST ONE of its shifts is in the matching state. The 'unconfirmed'
  // bucket combines pending_email + pending_approval — what an admin usually
  // wants when checking 'who still needs my attention'.
  const groups = filter === 'all'
    ? allGroups
    : allGroups.filter((rows) =>
        rows.some((r) =>
          filter === 'unconfirmed'
            ? r.status !== 'confirmed' && r.status !== 'rejected' && r.status !== 'cancelled'
            : r.status === filter,
        ),
      );

  // Pre-compute counts for the filter pills so admins see how many helpers
  // would land in each bucket without clicking.
  const filterCounts: Record<Filter, number> = {
    all: allGroups.length,
    unconfirmed: allGroups.filter((rs) => rs.some((r) => r.status !== 'confirmed' && r.status !== 'rejected' && r.status !== 'cancelled')).length,
    pending_email: allGroups.filter((rs) => rs.some((r) => r.status === 'pending_email')).length,
    pending_approval: allGroups.filter((rs) => rs.some((r) => r.status === 'pending_approval')).length,
    confirmed: allGroups.filter((rs) => rs.every((r) => r.status === 'confirmed')).length,
  };

  if (isLoading) {
    return <ListLoading />;
  }

  if (allGroups.length === 0) {
    return (
      <>
        <ListEmpty
          title={t('shifts.registration.noRegistrations')}
          description={t('shifts.registration.noRegistrationsDescription')}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
          action={
            <button
              className="btn btn--primary"
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setManualAddOpen(true)}
            >
              <UserPlus01 style={{ width: 16, height: 16 }} />
              <span>Helfer manuell eintragen</span>
            </button>
          }
        />
        <ManualAddRegistrationModal open={manualAddOpen} plan={plan} onClose={() => setManualAddOpen(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('shifts.registration.title')} ({groups.length}/{allGroups.length})
        </span>
        {(() => {
          const pills: Array<{ key: Filter; label: string }> = [
            { key: 'all', label: 'Alle' },
            { key: 'unconfirmed', label: 'Nicht bestätigt' },
            { key: 'pending_email', label: 'E-Mail offen' },
            { key: 'pending_approval', label: 'Approval offen' },
            { key: 'confirmed', label: 'Bestätigt' },
          ];
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {pills.map((p) => {
                const active = filter === p.key;
                const count = filterCounts[p.key];
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFilter(p.key)}
                    style={{
                      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 14%, transparent)'}`,
                      background: active ? 'color-mix(in oklab, var(--green-soft) 50%, var(--paper))' : 'transparent',
                      color: active ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 70%, transparent)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {p.label} <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn--ghost"
            style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setMessageHelper(null); setMessageModalOpen(true); }}
            disabled={allHelperEmails.length === 0}
            title="E-Mail an alle Helfer senden"
          >
            <Mail01 style={{ width: 16, height: 16 }} />
            <span>An alle senden</span>
          </button>
          <button
            className="btn btn--primary"
            style={iconBtnStyle()}
            onClick={() => setManualAddOpen(true)}
            title="Helfer manuell eintragen"
            aria-label="Helfer manuell eintragen"
          >
            <UserPlus01 style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{
          padding: '24px 16px', borderRadius: 8,
          background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
          color: 'color-mix(in oklab, var(--ink) 55%, transparent)',
          fontSize: 13, textAlign: 'center',
        }}>
          Keine Anmeldungen im aktuellen Filter — wähle einen anderen Filter oder „Alle".
        </div>
      )}
      {groups.map((group) => {
        const firstReg = group[0];
        // Take ONE representative reg per unique group so the action
        // mutations operate against every submission of the helper.
        const groupReps = Array.from(
          new Map(group.map((r) => [r.registrationGroupId, r])).values(),
        );
        const groupRepIds = groupReps.map((r) => r.id);
        // Status counts across all of the helper's rows so the badge and
        // the action buttons reflect the union of states, not just the
        // first row's.
        const statusCounts = group.reduce(
          (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
          {} as Record<ShiftRegistrationStatus, number>,
        );
        const total = group.length;
        const confirmed = statusCounts.confirmed ?? 0;
        const hasPendingEmail = (statusCounts.pending_email ?? 0) > 0;
        const hasPendingApproval = (statusCounts.pending_approval ?? 0) > 0;
        const allConfirmed = confirmed === total;
        const summaryBadge = allConfirmed
          ? { cls: 'badge badge--success', label: 'Alle bestätigt' }
          : hasPendingEmail
          ? { cls: 'badge badge--neutral', label: `${confirmed}/${total} bestätigt · E-Mail offen` }
          : hasPendingApproval
          ? { cls: 'badge badge--warning', label: `${confirmed}/${total} bestätigt · Approval offen` }
          : { cls: 'badge badge--neutral', label: `${confirmed}/${total} bestätigt` };

        return (
          <div key={helperKey(firstReg)} className="app-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'color-mix(in oklab, var(--ink) 8%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {firstReg.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{firstReg.name}</div>
                  <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{firstReg.email || '— ohne E-Mail —'}</div>
                  {firstReg.phone && (
                    <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{firstReg.phone}</div>
                  )}
                </div>
              </div>
              <span className={summaryBadge.cls}>{summaryBadge.label}</span>
            </div>

            {/* Shifts */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Schichten:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(() => {
                  // Detect overlapping rows within this helper's signups so
                  // the admin can spot double-bookings (typical when someone
                  // submitted the form twice or picked the wrong slot).
                  const overlapIds = new Set<string>();
                  for (let i = 0; i < group.length; i++) {
                    const a = group[i];
                    if (!a.shift) continue;
                    const aDate = (typeof a.shift.date === 'string' ? a.shift.date : '').slice(0, 10);
                    if (!aDate) continue;
                    const aBounds = shiftBoundsInMinutes(aDate, a.shift.startTime, a.shift.endTime);
                    for (let j = i + 1; j < group.length; j++) {
                      const b = group[j];
                      if (!b.shift) continue;
                      const bDate = (typeof b.shift.date === 'string' ? b.shift.date : '').slice(0, 10);
                      if (!bDate) continue;
                      const bBounds = shiftBoundsInMinutes(bDate, b.shift.startTime, b.shift.endTime);
                      const overlapMinutes =
                        Math.min(aBounds[1], bBounds[1]) - Math.max(aBounds[0], bBounds[0]);
                      if (overlapMinutes > HANDOVER_TOLERANCE_MINUTES) {
                        overlapIds.add(a.id);
                        overlapIds.add(b.id);
                      }
                    }
                  }
                  return group.map((reg) => {
                    const registeredAt = reg.createdAt ? new Date(reg.createdAt) : null;
                    const registeredAtLabel = registeredAt
                      ? registeredAt.toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : null;
                    const overlaps = overlapIds.has(reg.id);
                    const statusBadgeStyle =
                      reg.status === 'confirmed'
                        ? { bg: 'color-mix(in oklab, #10b981 18%, transparent)', fg: '#065f46', label: 'bestätigt' }
                        : reg.status === 'pending_email'
                        ? { bg: 'color-mix(in oklab, var(--warn) 18%, transparent)', fg: 'var(--warn-ink)', label: 'E-Mail offen' }
                        : reg.status === 'pending_approval'
                        ? { bg: 'color-mix(in oklab, var(--warn) 18%, transparent)', fg: 'var(--warn-ink)', label: 'Approval offen' }
                        : reg.status === 'rejected'
                        ? { bg: 'color-mix(in oklab, var(--danger) 18%, transparent)', fg: '#991b1b', label: 'abgelehnt' }
                        : { bg: 'color-mix(in oklab, var(--ink) 12%, transparent)', fg: 'color-mix(in oklab, var(--ink) 70%, transparent)', label: reg.status };

                    return (
                      <div
                        key={reg.id}
                        style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12,
                          padding: '6px 10px', borderRadius: 6,
                          background: overlaps
                            ? 'color-mix(in oklab, var(--warn) 8%, transparent)'
                            : 'color-mix(in oklab, var(--ink) 4%, transparent)',
                          border: overlaps
                            ? '1px solid color-mix(in oklab, var(--warn) 35%, transparent)'
                            : '1px solid transparent',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: reg.shift?.job?.color || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{reg.shift?.job?.name}</span>
                        <span style={{ color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>–</span>
                        <span>{formatDate(reg.shift?.date || '')}</span>
                        {reg.shift?.startTime && reg.shift?.endTime && (
                          <span className="mono">{formatTime(reg.shift.startTime)} – {formatTime(reg.shift.endTime)}</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                          background: statusBadgeStyle.bg, color: statusBadgeStyle.fg,
                          textTransform: 'uppercase', letterSpacing: '.03em',
                        }}>
                          {statusBadgeStyle.label}
                        </span>
                        {overlaps && (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--warn-ink)', fontWeight: 600 }}
                            title="Diese Schicht überschneidet sich zeitlich mit einer anderen Schicht des Helfers"
                          >
                            <AlertCircle style={{ width: 12, height: 12 }} />
                            Überschneidung
                          </span>
                        )}
                        <span style={{ flex: 1 }} />
                        {registeredAtLabel && (
                          <span
                            style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}
                            title={`Eingetragen am ${registeredAtLabel}`}
                          >
                            <Clock style={{ width: 10, height: 10, display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />
                            {registeredAtLabel}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{ padding: 2, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red, var(--danger))' }}
                          onClick={() => {
                            if (confirm(`Schicht "${reg.shift?.job?.name}" am ${formatDate(reg.shift?.date || '')} entfernen?`)) {
                              removeShiftMutation.mutate(reg.id);
                            }
                          }}
                          title="Diese Schicht entfernen"
                          aria-label="Diese Schicht entfernen"
                          disabled={removeShiftMutation.isPending}
                        >
                          <Trash01 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {firstReg.notes && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'color-mix(in oklab, var(--ink) 4%, transparent)', fontSize: 13 }}>
                <strong>Anmerkungen:</strong> {firstReg.notes}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              {hasPendingApproval && (() => {
                // One rep per group that has at least one pending_approval row.
                const pendingReps = Array.from(
                  new Map(
                    group.filter((r) => r.status === 'pending_approval')
                      .map((r) => [r.registrationGroupId, r]),
                  ).values(),
                ).map((r) => r.id);
                return (
                  <>
                    <button
                      className="btn btn--primary"
                      style={{ fontSize: 12 }}
                      onClick={() => approveMutation.mutate(pendingReps)}
                      disabled={approveMutation.isPending}
                    >
                      {t('shifts.registration.approve')}
                    </button>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, color: 'var(--red, var(--danger))' }}
                      onClick={() => rejectMutation.mutate(pendingReps)}
                      disabled={rejectMutation.isPending}
                    >
                      {t('shifts.registration.reject')}
                    </button>
                  </>
                );
              })()}
              {hasPendingEmail && (() => {
                const verifyReps = Array.from(
                  new Map(
                    group.filter((r) => r.status === 'pending_email')
                      .map((r) => [r.registrationGroupId, r]),
                  ).values(),
                ).map((r) => r.id);
                return (
                  <button
                    className="btn btn--ghost"
                    style={{ ...iconBtnStyle(), color: 'var(--green-ink)' }}
                    onClick={() => verifyMutation.mutate(verifyReps)}
                    disabled={verifyMutation.isPending}
                    title="Als verifiziert markieren (E-Mail-Bestätigung überspringen) — wirkt auf alle ausstehenden Schichten"
                    aria-label="Als verifiziert markieren"
                  >
                    <CheckCircle style={{ width: 16, height: 16 }} />
                  </button>
                );
              })()}
              <button
                className="btn btn--ghost"
                style={iconBtnStyle()}
                onClick={() => { setSelectedRegistration(firstReg); setEditOpen(true); }}
                title="Anmeldung bearbeiten"
                aria-label="Anmeldung bearbeiten"
              >
                <Edit01 style={{ width: 16, height: 16 }} />
              </button>
              <button
                className="btn btn--ghost"
                style={iconBtnStyle()}
                onClick={() => { setMessageHelper({ name: firstReg.name, email: firstReg.email }); setMessageModalOpen(true); }}
                title={t('shifts.registration.sendMessage')}
                aria-label={t('shifts.registration.sendMessage')}
              >
                <Mail01 style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn--ghost"
                style={iconBtnStyle('danger')}
                onClick={() => {
                  if (
                    confirm(
                      groupReps.length > 1
                        ? `${total} Schichten von ${firstReg.name} aus ${groupReps.length} Anmeldungen löschen?`
                        : t('shifts.registration.confirmDelete'),
                    )
                  ) deleteMutation.mutate(groupRepIds);
                }}
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                <Trash01 style={{ width: 16, height: 16 }} />
              </button>
              <span style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 40%, transparent)' }}>
                {formatDate(firstReg.createdAt)}
              </span>
            </div>
          </div>
        );
      })}

      <SendMessageModal
        open={messageModalOpen}
        plan={plan}
        helper={messageHelper}
        allHelperEmails={allHelperEmails}
        onClose={() => { setMessageModalOpen(false); setMessageHelper(null); }}
      />
      <ManualAddRegistrationModal
        open={manualAddOpen}
        plan={plan}
        onClose={() => setManualAddOpen(false)}
      />
      <EditRegistrationModal
        open={editOpen}
        plan={plan}
        registration={selectedRegistration}
        allRegistrations={registrations}
        onClose={() => { setEditOpen(false); setSelectedRegistration(null); }}
      />
    </div>
  );
}
