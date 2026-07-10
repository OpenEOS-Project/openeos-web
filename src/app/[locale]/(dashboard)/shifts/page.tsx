'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { formatDate } from '@/utils/format';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import type { ShiftPlan, ShiftPlanStatus } from '@/types/shift';
import { CreateShiftPlanModal } from './components/create-shift-plan-modal';

const statusBadge: Record<ShiftPlanStatus, string> = {
  draft: 'badge badge--neutral',
  published: 'badge badge--success',
  closed: 'badge badge--warning',
};

export default function ShiftsPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

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

  const copyPublicLink = async (planId: string, slug: string) => {
    const url = `${window.location.origin}/s/${slug}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedPlanId(planId);
      window.setTimeout(() => {
        setCopiedPlanId((current) => (current === planId ? null : current));
      }, 1800);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return <ListLoading />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-page-head">
        <div>
          <h1 className="app-page-head__title">{t('shifts.title')}</h1>
          <p className="app-page-head__sub">{t('shifts.description')}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
          {t('shifts.createPlan')}
        </button>
      </div>

      {plans.length === 0 ? (
        <ListEmpty
          title={t('shifts.noPlans')}
          description={t('shifts.noPlansDescription')}
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
          action={
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>
              {t('shifts.createFirstPlan')}
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {plans.map((plan: ShiftPlan) => {
            const jobCount = plan.jobs?.length || 0;

            return (
              <div key={plan.id} className="app-card">
                <div className="app-card__body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: 'color-mix(in oklab, var(--green-soft) 60%, var(--paper))',
                        color: 'var(--green-ink)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.name}</div>
                        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}>
                          {t('shifts.jobs', { count: jobCount })}
                        </div>
                      </div>
                    </div>
                    <span className={statusBadge[plan.status]} style={{ flexShrink: 0 }}>{t(`shifts.status.${plan.status}`)}</span>
                  </div>

                  {plan.description && (
                    <p style={{ fontSize: 13, color: 'color-mix(in oklab, var(--ink) 60%, transparent)', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {plan.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', marginBottom: 14 }}>
                    {plan.event && <span>{plan.event.name}</span>}
                    <span>{t('shifts.createdAt', { date: formatDate(plan.createdAt) })}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
                    <button className="btn btn--primary" style={{ fontSize: 13 }} onClick={() => router.push(`/shifts/${plan.id}`)}>
                      {t('common.edit')}
                    </button>
                    {plan.status === 'published' && (
                      <button
                        className="btn btn--ghost"
                        style={{
                          fontSize: 13,
                          color: copiedPlanId === plan.id ? 'var(--green-ink)' : undefined,
                          borderColor: copiedPlanId === plan.id ? 'var(--green-ink)' : undefined,
                        }}
                        title="Öffentlichen Link kopieren"
                        onClick={() => copyPublicLink(plan.id, plan.publicSlug)}
                      >
                        {copiedPlanId === plan.id ? '✓ Kopiert!' : 'Link kopieren'}
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 13, padding: '8px 10px', color: 'var(--red, var(--danger))' }}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      onClick={() => {
                        if (confirm(t('shifts.confirmDelete'))) {
                          deleteMutation.mutate(plan.id);
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
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
