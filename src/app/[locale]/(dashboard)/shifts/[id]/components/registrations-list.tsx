'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  XClose,
  Trash01,
  Mail01,
  Clock,
  CheckCircle,
  AlertCircle,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftRegistration, ShiftRegistrationStatus } from '@/types/shift';
import type { BadgeColors } from '@/components/ui/badges/badge-types';
import { SendMessageModal } from './send-message-modal';

// Format time to HH:MM (remove seconds if present)
const formatTime = (time: string): string => {
  const parts = time.split(':');
  return `${parts[0]}:${parts[1]}`;
};

const statusConfig: Record<ShiftRegistrationStatus, { color: BadgeColors; icon: typeof Clock }> = {
  pending_email: { color: 'gray', icon: Clock },
  pending_approval: { color: 'warning', icon: AlertCircle },
  confirmed: { color: 'success', icon: CheckCircle },
  rejected: { color: 'error', icon: XClose },
  cancelled: { color: 'gray', icon: XClose },
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
    mutationFn: (registrationId: string) =>
      shiftsApi.approveRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (registrationId: string) =>
      shiftsApi.rejectRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (registrationId: string) =>
      shiftsApi.deleteRegistration(organizationId!, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-registrations', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
    },
  });

  const registrations = registrationsData?.data || [];

  // Group registrations by registrationGroupId
  const groupedRegistrations = registrations.reduce((acc, reg) => {
    if (!acc[reg.registrationGroupId]) {
      acc[reg.registrationGroupId] = [];
    }
    acc[reg.registrationGroupId].push(reg);
    return acc;
  }, {} as Record<string, ShiftRegistration[]>);

  const groups = Object.values(groupedRegistrations).sort((a, b) => {
    return new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon="users"
        title={t('shifts.registration.noRegistrations')}
        description={t('shifts.registration.noRegistrationsDescription')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-primary">
        {t('shifts.registration.title')} ({registrations.length})
      </h2>

      <div className="space-y-4">
        {groups.map((group) => {
          const firstReg = group[0];
          const config = statusConfig[firstReg.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={firstReg.registrationGroupId}
              className="rounded-xl border border-secondary bg-primary p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <span className="text-sm font-medium text-primary">
                      {firstReg.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-primary">{firstReg.name}</h3>
                    <p className="text-sm text-tertiary">{firstReg.email}</p>
                    {firstReg.phone && (
                      <p className="text-sm text-tertiary">{firstReg.phone}</p>
                    )}
                  </div>
                </div>
                <Badge color={config.color} size="sm">
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {t(`shifts.registration.status.${firstReg.status}`)}
                </Badge>
              </div>

              {/* Shifts */}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-secondary">Schichten:</p>
                {group.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center gap-2 text-sm text-tertiary bg-secondary/50 rounded px-3 py-2"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: reg.shift?.job?.color || '#6b7280' }}
                    />
                    <span className="font-medium">{reg.shift?.job?.name}</span>
                    <span>-</span>
                    <span>{formatDate(reg.shift?.date || '')}</span>
                    <span>
                      {reg.shift?.startTime && reg.shift?.endTime
                        ? `${formatTime(reg.shift.startTime)} - ${formatTime(reg.shift.endTime)}`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>

              {firstReg.notes && (
                <div className="mt-3 rounded bg-secondary/50 p-3 text-sm text-secondary">
                  <strong>Anmerkungen:</strong> {firstReg.notes}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 border-t border-secondary pt-4">
                {firstReg.status === 'pending_approval' && (
                  <>
                    <Button
                      color="primary"
                      size="sm"
                      iconLeading={Check}
                      onClick={() => approveMutation.mutate(firstReg.id)}
                      isLoading={approveMutation.isPending}
                    >
                      {t('shifts.registration.approve')}
                    </Button>
                    <Button
                      color="secondary-destructive"
                      size="sm"
                      iconLeading={XClose}
                      onClick={() => rejectMutation.mutate(firstReg.id)}
                      isLoading={rejectMutation.isPending}
                    >
                      {t('shifts.registration.reject')}
                    </Button>
                  </>
                )}

                <Button
                  color="secondary"
                  size="sm"
                  iconLeading={Mail01}
                  onClick={() => {
                    setSelectedRegistration(firstReg);
                    setMessageModalOpen(true);
                  }}
                >
                  {t('shifts.registration.sendMessage')}
                </Button>

                <div className="flex-1" />

                <Button
                  color="secondary-destructive"
                  size="sm"
                  iconLeading={Trash01}
                  onClick={() => {
                    if (confirm(t('shifts.registration.confirmDelete'))) {
                      deleteMutation.mutate(firstReg.id);
                    }
                  }}
                />

                <span className="text-xs text-tertiary">
                  {formatDate(firstReg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <SendMessageModal
        open={messageModalOpen}
        registration={selectedRegistration}
        onClose={() => {
          setMessageModalOpen(false);
          setSelectedRegistration(null);
        }}
      />
    </div>
  );
}
