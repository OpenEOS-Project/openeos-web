'use client';

import { ClipboardCheck } from 'lucide-react';
import { Icon, type DataColumn, type RowAction } from '@openeos/ui';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { ListLoading, ListEmpty } from '@/components/shared/list-states';
import { ModuleGuard } from '@/components/shared/module-guard';
import {
  AdminTable,
  CellMain,
  CellNone,
  CellText,
  ListAction,
  ListCount,
  ListHead,
} from '@/components/shared/admin-table';
import '@/styles/admin-table-wave3.css';
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

  const openPlan = (plan: ShiftPlan) => router.push(`/shifts/${plan.id}`);

  const columns: DataColumn<ShiftPlan>[] = [
    {
      id: 'name',
      header: t('shifts.list.columns.name'),
      mobile: 'title',
      cell: (plan) => (
        <CellMain
          media={
            <span className="shifts-list__icon" aria-hidden>
              <ClipboardCheck size={16} />
            </span>
          }
          title={plan.name}
          titleText={plan.name}
          sub={plan.description || undefined}
          subText={plan.description || undefined}
        />
      ),
    },
    {
      id: 'jobs',
      header: t('shifts.list.columns.jobs'),
      mobile: 'meta',
      className: 'shifts-list__jobs',
      cell: (plan) => t('shifts.jobs', { count: plan.jobs?.length || 0 }),
    },
    {
      id: 'event',
      header: t('shifts.list.columns.event'),
      mobile: 'meta',
      priority: 2,
      cell: (plan) =>
        plan.event ? <CellText muted title={plan.event.name}>{plan.event.name}</CellText> : <CellNone />,
    },
    {
      id: 'status',
      header: t('shifts.list.columns.status'),
      mobile: 'subtitle',
      cell: (plan) => <span className={statusBadge[plan.status]}>{t(`shifts.status.${plan.status}`)}</span>,
    },
    {
      id: 'createdAt',
      header: t('shifts.list.columns.createdAt'),
      priority: 3,
      className: 'shifts-list__date',
      cell: (plan) => formatDate(plan.createdAt),
    },
  ];

  /* Bearbeiten öffnet auch der Klick auf die Zeile; der Link steht nur bei
     veröffentlichten Plänen, Löschen zuletzt im Menü. */
  const actions = (plan: ShiftPlan): RowAction[] => {
    const copied = copiedPlanId === plan.id;
    return [
      { id: 'edit', label: t('common.edit'), icon: 'edit', onClick: () => openPlan(plan) },
      {
        id: 'copyLink',
        label: copied ? t('shifts.list.copied') : t('shifts.list.copyPublicLink'),
        icon: copied ? 'check' : 'copy',
        hidden: plan.status !== 'published',
        onClick: () => copyPublicLink(plan.id, plan.publicSlug),
      },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        onClick: () => {
          if (confirm(t('shifts.confirmDelete'))) {
            deleteMutation.mutate(plan.id);
          }
        },
      },
    ];
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
        <div className="app-card app-card--flat">
          <ListHead
            actions={
              <ListAction
                variant="primary"
                icon="plus"
                label={t('shifts.createPlan')}
                onClick={() => setShowCreateModal(true)}
              />
            }
          >
            <ListCount>{t('shifts.count', { count: plans.length })}</ListCount>
          </ListHead>
          <AdminTable
            caption={t('shifts.title')}
            rows={plans}
            rowKey="id"
            columns={columns}
            actions={actions}
            onRowClick={(plan) => openPlan(plan)}
          />
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
