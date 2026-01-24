'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Trash01,
  Edit03,
  Check,
  Link01,
  Globe02,
  Lock01,
  Users01,
  Settings01,
  ClipboardCheck,
  FileDownload02,
  Calendar,
} from '@untitledui/icons';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';
import type { ShiftPlan, ShiftPlanStatus } from '@/types/shift';
import type { BadgeColors } from '@/components/ui/badges/badge-types';
import { JobsList } from './components/jobs-list';
import { RegistrationsList } from './components/registrations-list';
import { PlanSettings } from './components/plan-settings';
import { ShiftCalendar } from './components/shift-calendar';

const statusConfig: Record<ShiftPlanStatus, { color: BadgeColors; label: string }> = {
  draft: { color: 'gray', label: 'shifts.status.draft' },
  published: { color: 'success', label: 'shifts.status.published' },
  closed: { color: 'warning', label: 'shifts.status.closed' },
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

  const downloadPdf = () => {
    if (!plan || !organizationId) return;
    const url = shiftsApi.exportPdfUrl(organizationId, planId);
    // Open in new tab to trigger download with auth
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <p className="text-secondary">{t('shifts.noPlans')}</p>
      </div>
    );
  }

  const config = statusConfig[plan.status];

  return (
    <div className="-m-4 lg:-m-6 flex h-[calc(100vh-4rem)] flex-col bg-primary">
      {/* Header */}
      <div className="border-b border-secondary px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {/* Left side: Back button, info, badge */}
          <div className="flex items-center gap-4 min-w-0">
            <Button
              color="tertiary"
              size="sm"
              iconLeading={ArrowLeft}
              onClick={() => router.push('/shifts')}
            />
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
                <ClipboardCheck className="h-5 w-5 text-brand-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-primary">{plan.name}</h1>
                <div className="flex items-center gap-3 text-sm text-tertiary">
                  <span className="truncate">{plan.publicSlug}</span>
                  {plan.event && (
                    <>
                      <span className="text-quaternary">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{plan.event.name}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Badge color={config.color} size="md" className="flex-shrink-0">
              {t(config.label)}
            </Badge>
          </div>

          {/* Right side: Actions */}
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {plan.status === 'draft' && (
              <Button
                color="primary"
                iconLeading={Globe02}
                onClick={() => publishMutation.mutate()}
                isLoading={publishMutation.isPending}
              >
                {t('shifts.editor.publish')}
              </Button>
            )}

            {plan.status === 'published' && (
              <Button color="secondary" iconLeading={Link01} onClick={copyPublicLink}>
                {t('shifts.copyLink')}
              </Button>
            )}

            <Button color="secondary" iconLeading={FileDownload02} onClick={downloadPdf}>
              {t('shifts.exportPdf')}
            </Button>

            {plan.status === 'published' && (
              <Button
                color="secondary"
                iconLeading={Lock01}
                onClick={() => closeMutation.mutate()}
                isLoading={closeMutation.isPending}
              >
                {t('shifts.editor.close')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="flex-1 flex flex-col"
      >
        <TabList className="border-b border-secondary px-6">
          <Tab id="jobs" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {t('shifts.editor.jobs')}
          </Tab>
          <Tab id="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('shifts.calendar.title')}
          </Tab>
          <Tab id="registrations" className="flex items-center gap-2">
            <Users01 className="h-4 w-4" />
            {t('shifts.registrations')}
          </Tab>
          <Tab id="settings" className="flex items-center gap-2">
            <Settings01 className="h-4 w-4" />
            {t('shifts.settings.title')}
          </Tab>
        </TabList>

        <TabPanel id="jobs" className="flex-1 overflow-auto p-6">
          <JobsList plan={plan} />
        </TabPanel>

        <TabPanel id="calendar" className="flex-1 overflow-auto p-6">
          <ShiftCalendar plan={plan} />
        </TabPanel>

        <TabPanel id="registrations" className="flex-1 overflow-auto p-6">
          <RegistrationsList planId={plan.id} />
        </TabPanel>

        <TabPanel id="settings" className="flex-1 overflow-auto p-6">
          <PlanSettings plan={plan} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
