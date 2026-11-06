'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { privacyApi } from '@/lib/api-client';
import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';

const KEY = ['users', 'me', 'newsletter'] as const;

/**
 * Einwilligung in Neuigkeiten per E-Mail geben bzw. widerrufen
 * (Datenschutzerklärung 4.5, 13.3). Beide Zeitpunkte bleiben gespeichert.
 */
export function NewsletterCard() {
  const t = useTranslations('privacy.newsletter');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { formatDateTime } = useLocaleFormat();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await privacyApi.newsletter()).data,
  });
  const update = useMutation({
    mutationFn: async (subscribed: boolean) => (await privacyApi.setNewsletter(subscribed)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      toast.success(data.subscribed ? t('subscribed') : t('unsubscribed'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
  });

  return (
    <div className="app-card" data-testid="newsletter-card">
      <SettingsSectionHead icon="mail" title={t('title')} description={t('description')} />
      <SettingToggle
        label={t('label')}
        hint={t('hint')}
        checked={status?.subscribed ?? false}
        disabled={isLoading || update.isPending}
        onChange={(checked) => update.mutate(checked)}
      />
      {status && (status.consentedAt || status.withdrawnAt) && (
        <p className="privacy-muted" style={{ marginTop: 12 }} data-testid="newsletter-proof">
          {status.consentedAt && t('consentedAt', { date: formatDateTime(status.consentedAt) })}
          {status.consentedAt && status.withdrawnAt && ' · '}
          {status.withdrawnAt && t('withdrawnAt', { date: formatDateTime(status.withdrawnAt) })}
        </p>
      )}
      {status?.subscribed && !status.emailVerified && (
        <p className="privacy-muted" style={{ marginTop: 8 }}>{t('unverified')}</p>
      )}
    </div>
  );
}
