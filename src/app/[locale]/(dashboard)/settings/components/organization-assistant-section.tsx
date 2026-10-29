'use client';

import { useLocale, useTranslations } from 'next-intl';

import '@/styles/assistant.css';
import { Banner, Icon, Skeleton } from '@openeos/ui';

import { SettingToggle } from '@/components/shared/setting-toggle';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useAssistantStatus, useSetAssistantEnabled } from '@/hooks/use-assistant';
import { usePermissions } from '@/hooks/use-permissions';

import { privacyUrl, quotaLine } from '@/lib/assistant';

import { useAuthStore } from '@/stores/auth-store';

import type { AssistantQuota } from '@/types/assistant';

/**
 * Assistent-Funktionen der Organisation (ki-plan.md 6.6): Opt-in-Schalter
 * (Admin), was die Funktionen tun, der Hinweis auf den externen Anbieter
 * und das Tageskontingent.
 *
 * Ohne Anbieter auf dem Server (`available: false`) steht statt des
 * Schalters der Hinweis „Nicht eingerichtet“ — Self-Hoster tragen
 * AI_PROVIDER und Schlüssel in der API ein.
 */
export function OrganizationAssistantSection() {
  const t = useTranslations('settings.organizationAssistant');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const organizationId = currentOrganization?.organizationId ?? '';

  const status = useAssistantStatus(organizationId || undefined);
  const setEnabled = useSetAssistantEnabled(organizationId);

  if (!currentOrganization) return null;

  const onToggle = (checked: boolean) => {
    setEnabled.mutate(checked, {
      onSuccess: (data) => toast.success(data.enabled ? t('savedOn') : t('savedOff')),
      onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
    });
  };

  const data = status.data;

  let body: React.ReactNode;
  if (status.isLoading) {
    body = <Skeleton height={64} />;
  } else if (status.isError || !data) {
    body = (
      <Banner tone="danger" icon={<Icon name="alert" />}>
        {t('loadError')}
      </Banner>
    );
  } else if (!data.available) {
    body = (
      <Banner tone="info" icon={<Icon name="info" />} title={t('unavailable.title')}>
        {t('unavailable.text')}
      </Banner>
    );
  } else {
    body = (
      <>
        <SettingToggle
          label={t('toggle.label')}
          hint={t('toggle.hint')}
          checked={data.enabled}
          disabled={!isAdmin || setEnabled.isPending}
          onChange={onToggle}
        />
        {!isAdmin && (
          <p style={{ fontSize: 12, color: 'var(--mute)', margin: 0 }}>{t('adminOnly')}</p>
        )}
        {data.enabled && (
          <div className="assistant-quota">
            <span className="assistant-quota__title">{t('quota.title')}</span>
            <ul>
              <li>{quotaText(data.quotas.menuImports, 'imports', t)}</li>
              <li>{quotaText(data.quotas.classifications, 'icons', t)}</li>
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-card">
      <div className="app-card__head" style={{ display: 'block' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('title')}</h2>
        <p
          style={{
            fontSize: 13,
            color: 'color-mix(in oklab, var(--ink) 50%, transparent)',
            margin: '4px 0 0',
          }}
        >
          {t('description')}
        </p>
      </div>

      <div className="app-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {body}

        <div>
          <span className="assistant-features__title">{t('features.title')}</span>
          <ul className="assistant-features">
            <li>{t('features.menuImport')}</li>
            <li>{t('features.icons')}</li>
          </ul>
        </div>

        <p className="assistant-privacy">
          {t.rich('privacy', {
            link: (chunks) => (
              <a
                href={privacyUrl(locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="cash-tse-notice__link"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </div>
  );
}

function quotaText(
  quota: AssistantQuota | undefined,
  kind: 'imports' | 'icons',
  t: ReturnType<typeof useTranslations<'settings.organizationAssistant'>>
): string {
  const line = quotaLine(quota);
  if (line.kind === 'none') return '';
  if (line.kind === 'exhausted') return t(`quota.${kind}Exhausted`, { limit: line.limit });
  return t(`quota.${kind}`, { remaining: line.remaining, limit: line.limit });
}
