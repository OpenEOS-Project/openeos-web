'use client';

import { Check, ClipboardCheck } from 'lucide-react';
import { Icon } from '@openeos/ui';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import { ModuleGuard } from '@/components/shared/module-guard';
import type { ShiftPlan, ShiftPlanStatus } from '@/types/shift';
import { CreateShiftPlanModal } from './components/create-shift-plan-modal';

const statusBadge: Record<ShiftPlanStatus, string> = {
  draft: 'badge badge--neutral',
  published: 'badge badge--success',
  closed: 'badge badge--warning',
};

export default function ShiftsPage() {
  const t = useTranslations();
  const { formatDate } = useLocaleFormat();
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
    <ModuleGuard requiredPermission="shiftPlans">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Seitenkopf nur mit Titel und Beschreibung, wie auf allen
          Listenseiten. „Schichtplan erstellen" stand hier als einzige
          Seite oben rechts im Kopf; es gehoert in den Kopf der Karte,
          die die Plaene zeigt — dort sucht man es von den anderen
          Seiten her. */}
      <div className="app-page-head">
        <div className="app-page-head__copy">
          <h1 className="app-page-head__title">{t('shifts.title')}</h1>
          <p className="app-page-head__sub">{t('shifts.description')}</p>
        </div>
      </div>

      {plans.length === 0 ? (
        <ListEmpty
          title={t('shifts.noPlans')}
          description={t('shifts.noPlansDescription')}
          icon={
            <Icon name="calendar" size={28} />
          }
          action={
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              {t('shifts.createPlan')}
            </button>
          }
        />
      ) : (
        <div className="app-card">
          <div className="app-card__head">
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink)', opacity: .6 }}>{t('shifts.count', { count: plans.length })}</p>
            </div>
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              {t('shifts.createPlan')}
            </button>
          </div>
          <div className="app-card__body">
            {/* min(100%, …): auf einem schmalen Telefon ist die Karte keine
                340px breit, die Spalte darf dort nicht ueber den Rand laufen. */}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
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
                            <ClipboardCheck size={18} />
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
                            title={t('shifts.list.copyPublicLink')}
                            onClick={() => copyPublicLink(plan.id, plan.publicSlug)}
                          >
                            {copiedPlanId === plan.id ? (
                  <>
                    <Check aria-hidden />
                    {t('shifts.list.copied')}
                  </>
                ) : (
                  t('shifts.copyLink')
                )}
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
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
    </ModuleGuard>
  );
}
