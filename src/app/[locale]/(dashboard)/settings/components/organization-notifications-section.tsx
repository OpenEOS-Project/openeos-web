'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useDeployment } from '@/components/providers/setup-provider';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { usePermissions } from '@/hooks/use-permissions';
import { organizationsApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

import type { EventReminderSettings } from '@/types/organization';
import { SettingsSectionHead } from './settings-section-head';

type ReminderKey = keyof EventReminderSettings;

/**
 * „Erinnerungen zu Veranstaltungen“: je Mail ein Schalter für alle Admins
 * der Organisation (Standard an). Die API führt `settings.eventReminders`
 * zusammen, deshalb geht nur der geänderte Schalter mit. „Noch nicht
 * freigeschaltet“ gibt es nur mit Abrechnung — auf einer eigenen
 * Installation fehlt der Schalter.
 */
export function OrganizationNotificationsSection() {
  const t = useTranslations('settings.organizationNotifications');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const deployment = useDeployment();
  const { isAdmin } = usePermissions();
  const { currentOrganization, setCurrentOrganization } = useAuthStore();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: async (patch: Partial<EventReminderSettings>) => {
      if (!currentOrganization) throw new Error('No organization');
      const response = await organizationsApi.update(currentOrganization.organizationId, {
        settings: { eventReminders: patch },
      });
      return response.data;
    },
    onSuccess: (data) => {
      const latest = useAuthStore.getState().currentOrganization;
      if (latest?.organization && latest.organizationId === data.id) {
        setCurrentOrganization({ ...latest, organization: data });
      }
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success(t('saved'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  if (!currentOrganization) return null;

  const current = currentOrganization.organization?.settings?.eventReminders ?? {};
  const keys: ReminderKey[] = [
    'weekBefore',
    'dayBefore',
    'afterEvent',
    ...(deployment.billingEnabled ? (['notBooked'] as ReminderKey[]) : []),
  ];

  return (
    <div className="app-card" data-testid="org-event-reminders">
      <SettingsSectionHead icon="bell" title={t('title')} description={t('description')} />
      <div className="oe-setting-list">
        {keys.map((key) => (
          <SettingToggle
            key={key}
            flush
            label={t(`${key}.label`)}
            hint={t(`${key}.hint`)}
            checked={current[key] !== false}
            disabled={!isAdmin || update.isPending}
            onChange={(value) => update.mutate({ [key]: value })}
          />
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--mute)', margin: '12px 0 0' }}>
        {isAdmin ? t('personalHint') : t('adminOnly')}
      </p>
    </div>
  );
}
