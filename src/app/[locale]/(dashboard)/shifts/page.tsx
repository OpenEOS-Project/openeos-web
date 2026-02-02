'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ClipboardCheck,
  Edit03,
  Trash01,
  Link01,
  Eye,
  Users01,
  Calendar,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { EmptyState } from '@/components/ui/empty-state/empty-state';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import type { ShiftPlan, ShiftPlanStatus } from '@/types/shift';
import type { BadgeColors } from '@/components/ui/badges/badge-types';
import { CreateShiftPlanModal } from './components/create-shift-plan-modal';

const statusConfig: Record<ShiftPlanStatus, { color: BadgeColors; label: string }> = {
  draft: { color: 'gray', label: 'shifts.status.draft' },
  published: { color: 'success', label: 'shifts.status.published' },
  closed: { color: 'warning', label: 'shifts.status.closed' },
};

export default function ShiftsPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['shift-plans', organizationId],
    queryFn: () => shiftsApi.listPlans(organizationId!),
    enabled: !!organizationId,
  });

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => shiftsApi.deletePlan(organizationId!, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
    },
  });

  const plans = plansData?.data || [];

  const copyPublicLink = async (slug: string) => {
    const url = `${window.location.origin}/s/${slug}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('shifts.title')}</h1>
          <p className="text-secondary">{t('shifts.description')}</p>
        </div>
        <Button color="primary" iconLeading={Plus} onClick={() => setShowCreateModal(true)}>
          {t('shifts.createPlan')}
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('shifts.noPlans')}
          description={t('shifts.noPlansDescription')}
          action={
            <Button color="primary" iconLeading={Plus} onClick={() => setShowCreateModal(true)}>
              {t('shifts.createFirstPlan')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan: ShiftPlan) => {
            const config = statusConfig[plan.status];
            const jobCount = plan.jobs?.length || 0;

            return (
              <div
                key={plan.id}
                className="rounded-xl border border-secondary bg-primary p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-secondary">
                      <ClipboardCheck className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-primary">{plan.name}</h3>
                      <p className="text-sm text-tertiary">
                        {t('shifts.jobs', { count: jobCount })}
                      </p>
                    </div>
                  </div>
                  <Badge color={config.color} size="sm">
                    {t(config.label)}
                  </Badge>
                </div>

                {plan.description && (
                  <p className="mt-3 text-sm text-secondary line-clamp-2">{plan.description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary">
                  {plan.event && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {plan.event.name}
                    </span>
                  )}
                  <span>{t('shifts.createdAt', { date: formatDate(plan.createdAt) })}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-secondary pt-4">
                  <Button
                    color="secondary"
                    size="sm"
                    iconLeading={Edit03}
                    onClick={() => router.push(`/shifts/${plan.id}`)}
                  >
                    {t('common.edit')}
                  </Button>

                  <Button
                    color="secondary"
                    size="sm"
                    iconLeading={Users01}
                    onClick={() => router.push(`/shifts/${plan.id}?tab=registrations`)}
                  >
                    {t('shifts.registrations')}
                  </Button>

                  {plan.status === 'published' && (
                    <>
                      <Button
                        color="secondary"
                        size="sm"
                        iconLeading={Link01}
                        onClick={() => copyPublicLink(plan.publicSlug)}
                      />
                      <Button
                        color="secondary"
                        size="sm"
                        iconLeading={Eye}
                        onClick={() => window.open(`/s/${plan.publicSlug}`, '_blank')}
                      />
                    </>
                  )}

                  <div className="flex-1" />

                  <Button
                    color="secondary-destructive"
                    size="sm"
                    iconLeading={Trash01}
                    onClick={() => {
                      if (confirm(t('shifts.confirmDelete'))) {
                        deleteMutation.mutate(plan.id);
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateShiftPlanModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(plan) => {
          setShowCreateModal(false);
          router.push(`/shifts/${plan.id}`);
        }}
      />
    </div>
  );
}
