'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { ListLoading } from '@/components/shared/list-states';
import { DetailPageHead } from '@/components/shared/detail-page-head';
import type { ShiftPlanStatus } from '@/types/shift';
import { JobsList } from './components/jobs-list';
import { RegistrationsList } from './components/registrations-list';
import { PlanSettings } from './components/plan-settings';
import { ShiftCalendar } from './components/shift-calendar';
import { ClipboardCheck } from 'lucide-react';

const statusBadge: Record<ShiftPlanStatus, string> = {
  draft: 'badge badge--neutral',
  published: 'badge badge--success',
  closed: 'badge badge--warning',
};

export default function ShiftPlanEditorPage() {
  const t = useTranslations();
  const apiErrorMessage = useApiErrorMessage();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const planId = params.id as string;

  const initialTab = searchParams.get('tab') || 'jobs';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: planData, isLoading } = useQuery({
    queryKey: ['shift-plan', organizationId, planId],
    queryFn: () => shiftsApi.getPlan(organizationId!, planId),
    enabled: !!organizationId && !!planId,
  });

  const publishMutation = useMutation({
    mutationFn: () => shiftsApi.publishPlan(organizationId!, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => shiftsApi.closePlan(organizationId!, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      queryClient.invalidateQueries({ queryKey: ['shift-plans', organizationId] });
    },
  });

  const plan = planData?.data;

  const copyPublicLink = async () => {
    if (!plan) return;
    const url = `${window.location.origin}/s/${plan.publicSlug}`;
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
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadPdf = async () => {
    if (!plan || !organizationId) return;
    try {
      const blob = await shiftsApi.exportPdf(organizationId, planId);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${plan.publicSlug || t('shifts.detail.pdfFileName')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hand the browser a moment to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) {
      alert(apiErrorMessage(err, t('shifts.detail.pdfExportFailed')));
    }
  };

  if (isLoading) {
    return <ListLoading />;
  }

  if (!plan) {
    return (
      <div className="app-card">
        <p style={{ color: 'color-mix(in oklab, var(--ink) 55%, transparent)' }}>{t('shifts.noPlans')}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'jobs', label: t('shifts.editor.jobs') },
    { id: 'calendar', label: t('shifts.calendar.title') },
    { id: 'registrations', label: t('shifts.registrations') },
    { id: 'settings', label: t('shifts.settings.title') },
  ];

  return (
    <div>
      <DetailPageHead
        backHref="/shifts"
        backLabel={t('common.back')}
        icon={<ClipboardCheck />}
        title={plan.name}
        meta={
          <>
            <span style={{ fontFamily: 'var(--f-mono)' }}>{plan.publicSlug}</span>
            {plan.event && <><span aria-hidden="true">•</span><span>{plan.event.name}</span></>}
          </>
        }
        badges={<span className={statusBadge[plan.status]}>{t(`shifts.status.${plan.status}`)}</span>}
        actions={
          <>
            {/* Beschriftet statt nur Symbole: „Schloss" und „Pfeil" musste
                man vorher erst per Tooltip erraten. */}
            {plan.status === 'published' && (
              <button
                className="btn btn--ghost"
                style={linkCopied ? { color: 'var(--green-ink)', borderColor: 'var(--green-ink)' } : undefined}
                onClick={copyPublicLink}
              >
                {linkCopied ? t('shifts.detail.linkCopied') : t('shifts.copyLink')}
              </button>
            )}
            <button className="btn btn--ghost" onClick={downloadPdf}>
              {t('shifts.exportPdf')}
            </button>
            {plan.status === 'published' && (
              <button
                className="btn btn--ghost"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                {t('shifts.editor.closePlan')}
              </button>
            )}
            {plan.status === 'draft' && (
              <button
                className="btn btn--primary"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {t('shifts.editor.publish')}
              </button>
            )}
          </>
        }
      />

      {/* Tableiste wie auf der Geraete- und der Druckerseite: unter dem
          Seitenkopf statt mit ihm in einer Karte. */}
      <div
        style={{
          borderBottom: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
          display: 'flex', gap: 0, marginBottom: 24, overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--green-ink)'
                : '2px solid transparent',
              color: activeTab === tab.id
                ? 'var(--green-ink)'
                : 'color-mix(in oklab, var(--ink) 55%, transparent)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'jobs' && <JobsList plan={plan} />}
        {activeTab === 'calendar' && <ShiftCalendar plan={plan} />}
        {activeTab === 'registrations' && <RegistrationsList plan={plan} />}
        {activeTab === 'settings' && <PlanSettings plan={plan} />}
      </div>
    </div>
  );
}
