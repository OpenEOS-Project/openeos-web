'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftRegistration, ShiftRegistrationStatus } from '@/types/shift';
import { SendMessageModal } from './send-message-modal';

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
  planId: string;
}

export function RegistrationsList({ planId }: RegistrationsListProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [messageModalOpen, setMessageModalOpen] = useState(false);
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

  const groupedRegistrations = registrations.reduce((acc, reg) => {
    if (!acc[reg.registrationGroupId]) acc[reg.registrationGroupId] = [];
    acc[reg.registrationGroupId].push(reg);
    return acc;
  }, {} as Record<string, ShiftRegistration[]>);

  const groups = Object.values(groupedRegistrations).sort((a, b) =>
    new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime()
  );

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
      <div className="empty-state">
        <div className="empty-state__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <h3 className="empty-state__title">{t('shifts.registration.noRegistrations')}</h3>
        <p className="empty-state__sub">{t('shifts.registration.noRegistrationsDescription')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        {t('shifts.registration.title')} ({registrations.length})
      </div>

      {groups.map((group) => {
        const firstReg = group[0];
        const badgeCls = statusBadge[firstReg.status] ?? 'badge badge--neutral';

        return (
          <div key={firstReg.registrationGroupId} className="app-card">
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
                {group.map((reg) => (
                  <div
                    key={reg.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
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
                  </div>
                ))}
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
                style={{ fontSize: 12 }}
                onClick={() => { setSelectedRegistration(firstReg); setMessageModalOpen(true); }}
              >
                {t('shifts.registration.sendMessage')}
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn--ghost"
                style={{ fontSize: 12, color: 'var(--red, #dc2626)' }}
                onClick={() => {
                  if (confirm(t('shifts.registration.confirmDelete'))) deleteMutation.mutate(firstReg.id);
                }}
              >
                {t('common.delete')}
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
    </div>
  );
}
