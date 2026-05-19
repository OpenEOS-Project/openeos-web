'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftRegistration, ShiftRegistrationStatus } from '@/types/shift';
import { SendMessageModal } from './send-message-modal';
import { ManualAddRegistrationModal } from './manual-add-registration-modal';
import { EditRegistrationModal } from './edit-registration-modal';
import { Edit01, Trash01, UserPlus01, Mail01 } from '@untitledui/icons';

const iconBtnStyle = (variant: 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
  padding: 6,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: variant === 'danger' ? 'var(--red, #dc2626)' : 'inherit',
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
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<ShiftRegistration | null>(null);

  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['shift-registrations', organizationId, planId],
    queryFn: () => shiftsApi.listRegistrations(organizationId!, planId),
    enabled: !!organizationId && !!planId,
  });

  const approveMutation = useMutation({
    mutationFn: (registrationId: string) => shiftsApi.approveRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (registrationId: string) => shiftsApi.rejectRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (registrationId: string) => shiftsApi.deleteRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const registrations = registrationsData?.data || [];

  // Group helpers by their email (case-insensitive) so a person who signed
  // up multiple times shows up as ONE card with all their shifts merged,
  // not scattered across several entries.
  const helperGroups = registrations.reduce((acc, reg) => {
    const key = reg.email.trim().toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(reg);
    return acc;
  }, {} as Record<string, ShiftRegistration[]>);

  const groups = Object.values(helperGroups)
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--green-ink)', borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <>
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3 className="empty-state__title">{t('shifts.registration.noRegistrations')}</h3>
          <p className="empty-state__sub">{t('shifts.registration.noRegistrationsDescription')}</p>
          <button
            className="btn btn--primary"
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setManualAddOpen(true)}
          >
            <UserPlus01 style={{ width: 16, height: 16 }} />
            <span>Helfer manuell eintragen</span>
          </button>
        </div>
        <ManualAddRegistrationModal open={manualAddOpen} plan={plan} onClose={() => setManualAddOpen(false)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('shifts.registration.title')} ({registrations.length})
        </span>
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

      {groups.map((group) => {
        const firstReg = group[0];
        const badgeCls = statusBadge[firstReg.status] ?? 'badge badge--neutral';

        return (
          <div key={firstReg.email.trim().toLowerCase()} className="app-card">
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
                  <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{firstReg.email}</div>
                  {firstReg.phone && (
                    <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 50%, transparent)' }}>{firstReg.phone}</div>
                  )}
                </div>
              </div>
              <span className={badgeCls}>{t(`shifts.registration.status.${firstReg.status}`)}</span>
            </div>

            {/* Shifts */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>Schichten:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.map((reg) => {
                  // Exact wall-clock time when this shift was added to the
                  // helper's signup — surfaced so the admin can tell apart
                  // older signups from new auto-confirmations.
                  const registeredAt = reg.createdAt ? new Date(reg.createdAt) : null;
                  const registeredAtLabel = registeredAt
                    ? registeredAt.toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : null;
                  return (
                    <div
                      key={reg.id}
                      style={{
                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12,
                        padding: '6px 10px', borderRadius: 6,
                        background: 'color-mix(in oklab, var(--ink) 4%, transparent)',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: reg.shift?.job?.color || '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{reg.shift?.job?.name}</span>
                      <span style={{ color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>–</span>
                      <span>{formatDate(reg.shift?.date || '')}</span>
                      {reg.shift?.startTime && reg.shift?.endTime && (
                        <span className="mono">{formatTime(reg.shift.startTime)} – {formatTime(reg.shift.endTime)}</span>
                      )}
                      <span style={{ flex: 1 }} />
                      {registeredAtLabel && (
                        <span
                          style={{ fontSize: 11, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}
                          title={`Eingetragen am ${registeredAtLabel}`}
                        >
                          eingetragen {registeredAtLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {firstReg.notes && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'color-mix(in oklab, var(--ink) 4%, transparent)', fontSize: 13 }}>
                <strong>Anmerkungen:</strong> {firstReg.notes}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
              {firstReg.status === 'pending_approval' && (
                <>
                  <button
                    className="btn btn--primary"
                    style={{ fontSize: 12 }}
                    onClick={() => approveMutation.mutate(firstReg.id)}
                    disabled={approveMutation.isPending}
                  >
                    {t('shifts.registration.approve')}
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}
                    onClick={() => rejectMutation.mutate(firstReg.id)}
                    disabled={rejectMutation.isPending}
                  >
                    {t('shifts.registration.reject')}
                  </button>
                </>
              )}
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
                onClick={() => { setSelectedRegistration(firstReg); setMessageModalOpen(true); }}
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
                  if (confirm(t('shifts.registration.confirmDelete'))) deleteMutation.mutate(firstReg.id);
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
        registration={selectedRegistration}
        onClose={() => { setMessageModalOpen(false); setSelectedRegistration(null); }}
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
