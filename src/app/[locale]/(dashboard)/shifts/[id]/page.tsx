'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import { ListLoading } from '@/components/shared/list-states';
import type { ShiftPlan, ShiftPlanStatus } from '@/types/shift';
import { JobsList } from './components/jobs-list';
import { RegistrationsList } from './components/registrations-list';
import { PlanSettings } from './components/plan-settings';
import { ShiftCalendar } from './components/shift-calendar';
import { Send01, Link01, Download01, Lock01, CheckCircle } from '@untitledui/icons';

/** Square 36×36 icon-button — keeps the plan-header row compact on phones. */
const iconBtnStyle = (variant: 'ghost' | 'primary' = 'ghost'): React.CSSProperties => ({
  padding: 6,
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...(variant === 'primary'
    ? { background: 'var(--green-ink)', color: 'var(--paper)' }
    : {}),
});

const statusBadge: Record<ShiftPlanStatus, string> = {
  draft: 'badge badge--neutral',
  published: 'badge badge--success',
  closed: 'badge badge--warning',
};

export default function ShiftPlanEditorPage() {
  const t = useTranslations();
  const router = useRouter();
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
      a.download = `${plan.publicSlug || 'schichtplan'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hand the browser a moment to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) {
      alert((err as Error).message || 'PDF-Export fehlgeschlagen');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header card */}
      <div className="app-card">
        <div className="app-card__body" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <button
                className="btn btn--ghost"
                style={{ flexShrink: 0, padding: '8px 10px' }}
                onClick={() => router.push('/shifts')}
                aria-label="Zurück"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
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
                <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--ink) 45%, transparent)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--f-mono)' }}>{plan.publicSlug}</span>
                  {plan.event && <><span>•</span><span>{plan.event.name}</span></>}
                </div>
              </div>
              <span className={statusBadge[plan.status]} style={{ flexShrink: 0 }}>{t(`shifts.status.${plan.status}`)}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {plan.status === 'draft' && (
                <button
                  className="btn btn--primary"
                  style={iconBtnStyle('primary')}
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  title={t('shifts.editor.publish')}
                  aria-label={t('shifts.editor.publish')}
                >
                  <Send01 style={{ width: 18, height: 18 }} />
                </button>
              )}
              {plan.status === 'published' && (
                <button
                  className="btn btn--ghost"
                  style={{
                    ...iconBtnStyle(),
                    color: linkCopied ? 'var(--green-ink)' : undefined,
                    borderColor: linkCopied ? 'var(--green-ink)' : undefined,
                  }}
                  onClick={copyPublicLink}
                  title={linkCopied ? 'Link kopiert' : t('shifts.copyLink')}
                  aria-label={t('shifts.copyLink')}
                >
                  {linkCopied
                    ? <CheckCircle style={{ width: 18, height: 18 }} />
                    : <Link01 style={{ width: 18, height: 18 }} />}
                </button>
              )}
              <button
                className="btn btn--ghost"
                style={iconBtnStyle()}
                onClick={downloadPdf}
                title={t('shifts.exportPdf')}
                aria-label={t('shifts.exportPdf')}
              >
                <Download01 style={{ width: 18, height: 18 }} />
              </button>
              {plan.status === 'published' && (
                <button
                  className="btn btn--ghost"
                  style={iconBtnStyle()}
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  title={t('shifts.editor.close')}
                  aria-label={t('shifts.editor.close')}
                >
                  <Lock01 style={{ width: 18, height: 18 }} />
                </button>
              )}
            </div>
          </div>

          {/* Tab bar inside the same card */}
          <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '1px solid color-mix(in oklab, var(--ink) 7%, transparent)', marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, overflowX: 'auto' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 55%, transparent)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--green-ink)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
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
