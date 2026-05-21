'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash01, Plus, CheckCircle, AlertCircle, Clock, Calendar } from '@untitledui/icons';

import { shiftsPublicApi } from '@/lib/api-client';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTime = (t: string) => t.slice(0, 5);

/** Convert (date, start, end) → absolute minutes-since-epoch, overnight-safe. */
function bounds(date: string, start: string, end: string): [number, number] {
  const day = Math.floor(new Date(date).getTime() / 86_400_000);
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e <= s) e += 1440;
  return [day * 1440 + s, day * 1440 + e];
}

/**
 * Public helper self-service: opens via the magic-link email. Shows the
 * helper's current shifts in this plan, lets them delete individual ones,
 * and pick new shifts from the same job grid the admin's signup page uses.
 */
export default function HelperManagePage() {
  const { token } = useParams() as { token: string };
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['helper-manage', token],
    queryFn: () => shiftsPublicApi.openHelperManage(token),
    enabled: !!token,
    retry: false,
  });

  const removeMutation = useMutation({
    mutationFn: (registrationId: string) => shiftsPublicApi.removeShiftViaMagicLink(token, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-manage', token] });
      setToast('Schicht entfernt.');
      setTimeout(() => setToast(null), 2500);
    },
    onError: (err: Error) => setError(err.message || 'Schicht konnte nicht entfernt werden.'),
  });

  const addMutation = useMutation({
    mutationFn: (shiftId: string) => shiftsPublicApi.addShiftViaMagicLink(token, shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['helper-manage', token] });
      setToast('Schicht hinzugefügt.');
      setTimeout(() => setToast(null), 2500);
    },
    onError: (err: Error) => setError(err.message || 'Schicht konnte nicht hinzugefügt werden.'),
  });

  const payload = data?.data;
  const helper = payload?.helper;
  const plan = payload?.plan;
  const registrations = payload?.registrations ?? [];

  // Mark overlapping registrations so the helper sees double-bookings.
  const overlapIds = useMemo(() => {
    const out = new Set<string>();
    for (let i = 0; i < registrations.length; i++) {
      const a = registrations[i];
      const aDate = (a.date || '').slice(0, 10);
      if (!aDate) continue;
      const aBounds = bounds(aDate, a.startTime, a.endTime);
      for (let j = i + 1; j < registrations.length; j++) {
        const b = registrations[j];
        const bDate = (b.date || '').slice(0, 10);
        if (!bDate) continue;
        const bBounds = bounds(bDate, b.startTime, b.endTime);
        if (Math.min(aBounds[1], bBounds[1]) > Math.max(aBounds[0], bBounds[0])) {
          out.add(a.id); out.add(b.id);
        }
      }
    }
    return out;
  }, [registrations]);

  const currentShiftIds = useMemo(() => new Set(registrations.map((r) => r.shiftId)), [registrations]);

  if (isLoading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (isError || !payload) {
    return (
      <main style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <AlertCircle style={{ width: 48, height: 48, color: '#dc2626', margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Link ungültig</h1>
          <p style={{ color: 'var(--mute, #666)', fontSize: 14, marginTop: 8 }}>
            Der Verwaltungs-Link ist abgelaufen oder existiert nicht. Fordere einen neuen Link auf der Plan-Seite an.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 640 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <Image src="/logo_dark.png" alt="OpenEOS" width={140} height={36} style={{ height: 28, width: 'auto' }} />
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, textAlign: 'center' }}>{plan!.name}</h1>
        <p style={{ color: 'var(--mute, #666)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
          Hallo {helper!.name} — hier sind deine Schichten.
        </p>

        {toast && (
          <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'color-mix(in oklab, #10b981 12%, transparent)', color: '#065f46', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle style={{ width: 14, height: 14 }} />
            <span>{toast}</span>
          </div>
        )}
        {error && (
          <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: 'color-mix(in oklab, #dc2626 12%, transparent)', color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registrations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--mute)', fontSize: 13 }}>
              Du hast aktuell keine Schichten eingetragen.
            </div>
          ) : (
            registrations.map((reg) => {
              const overlaps = overlapIds.has(reg.id);
              return (
                <div
                  key={reg.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: overlaps
                      ? 'color-mix(in oklab, #f59e0b 8%, transparent)'
                      : 'color-mix(in oklab, var(--ink) 4%, transparent)',
                    border: overlaps ? '1px solid color-mix(in oklab, #f59e0b 35%, transparent)' : '1px solid transparent',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: reg.jobColor || '#6b7280', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{reg.jobName}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar style={{ width: 12, height: 12 }} />
                        {formatDate(reg.date)}
                      </span>
                      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock style={{ width: 12, height: 12 }} />
                        {formatTime(reg.startTime)}–{formatTime(reg.endTime)}
                      </span>
                      {overlaps && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#b45309', fontWeight: 600 }}>
                          <AlertCircle style={{ width: 12, height: 12 }} />
                          Überschneidung
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: 6, width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}
                    onClick={() => {
                      if (confirm(`Schicht "${reg.jobName}" am ${formatDate(reg.date)} ${formatTime(reg.startTime)}–${formatTime(reg.endTime)} entfernen?`)) {
                        removeMutation.mutate(reg.id);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    title="Diese Schicht entfernen"
                    aria-label="Schicht entfernen"
                  >
                    <Trash01 style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              );
            })
          )}
        </section>

        <button
          type="button"
          className="btn btn--primary"
          style={{ marginTop: 18, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <Plus style={{ width: 16, height: 16 }} />
          <span>{pickerOpen ? 'Schicht-Liste schließen' : 'Weitere Schicht hinzufügen'}</span>
        </button>

        {pickerOpen && plan && (
          <section style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan.jobs.flatMap((job) =>
              job.shifts
                .filter((s) => !currentShiftIds.has(s.id) && !s.isFull)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addMutation.mutate(s.id)}
                    disabled={addMutation.isPending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid color-mix(in oklab, var(--ink) 12%, transparent)',
                      background: 'var(--paper)', textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: job.color || '#6b7280', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{job.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)' }}>
                        {formatDate(s.date)} · {formatTime(s.startTime)}–{formatTime(s.endTime)} · {s.availableSpots}/{s.requiredWorkers} frei
                      </div>
                    </div>
                    <span style={{ color: 'var(--green-ink)', fontSize: 12, fontWeight: 600 }}>+ eintragen</span>
                  </button>
                )),
            )}
          </section>
        )}

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--mute-2, #999)' }}>
          Dein Verwaltungs-Link gilt 24 Stunden. Danach kannst du auf der Plan-Seite einen neuen anfordern.
        </p>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: 24, background: 'var(--paper-2, #f4f4f5)',
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480, background: 'var(--paper)', borderRadius: 14,
  padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
