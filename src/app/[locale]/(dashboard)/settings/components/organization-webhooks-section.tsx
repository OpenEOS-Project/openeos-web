'use client';

import { useLocale, useTranslations } from 'next-intl';

import '@/styles/api-tokens.css';
import '@/styles/webhooks.css';
import { Banner, Icon, Skeleton } from '@openeos/ui';

import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useWebhookInfo, useWebhooks } from '@/hooks/use-webhooks';

import { Link } from '@/i18n/routing';

import { DEFAULT_MAX_WEBHOOK_ENDPOINTS, webhookDocsUrl, webhookLimitReached } from '@/lib/webhooks';

import { useAuthStore } from '@/stores/auth-store';

import type { WebhookEndpoint } from '@/types/webhook';

import { SettingsSectionHead } from './settings-section-head';
import { OrganizationIdField } from './organization-id-field';
import { useWebhookActions, WebhookIconButton } from './webhook-actions';
import { WebhookStatusPill } from './webhook-ui';

/**
 * Ausgehende Webhooks der Organisation: Liste mit Status und letzter
 * Zustellung, Anlegen und Bearbeiten im Dialog, das Zustellprotokoll auf
 * einer eigenen Seite (/settings/webhooks/[id]). Wie bei den Zugängen
 * sehen nur Admins die Liste; Mitglieder bekommen den Hinweis.
 */
export function OrganizationWebhooksSection() {
  const t = useTranslations('settings.organizationWebhooks');
  const locale = useLocale();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  /* Ab Tablet-Breite die Tabelle, darunter kompakte Zeilen — nichts soll
     seitlich scrollen. */
  const desktop = useBreakpoint('md');
  const organizationId = currentOrganization?.organizationId ?? '';

  const info = useWebhookInfo(organizationId || undefined, isAdmin);
  const webhooks = useWebhooks(organizationId || undefined, isAdmin);
  const actions = useWebhookActions(organizationId);

  if (!currentOrganization) return null;

  const list = webhooks.data ?? [];
  const maxEndpoints = info.data?.maxEndpoints ?? DEFAULT_MAX_WEBHOOK_ENDPOINTS;
  const limitReached = webhookLimitReached(list.length, maxEndpoints);
  const serverDisabled = info.data?.enabled === false;

  let body: React.ReactNode;
  if (!isAdmin) {
    body = (
      <Banner tone="info" icon={<Icon name="lock" />}>
        {t('adminOnly')}
      </Banner>
    );
  } else if (webhooks.isLoading) {
    body = <Skeleton height={96} />;
  } else if (webhooks.isError) {
    body = (
      <Banner tone="danger" icon={<Icon name="alert" />}>
        {t('loadError')}
      </Banner>
    );
  } else {
    body = (
      <>
        {serverDisabled && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('disabled.title')}>
            {t('disabled.text')}
          </Banner>
        )}

        <div className="api-tokens__toolbar">
          <p className="api-tokens__count">{t('count', { count: list.length, limit: maxEndpoints })}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={actions.openCreate}
            disabled={limitReached || serverDisabled || info.isLoading}
          >
            <Icon name="plus" />
            {t('create')}
          </button>
        </div>

        {limitReached && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('limit.title')}>
            {t('limit.text', { limit: maxEndpoints })}
          </Banner>
        )}

        {list.length === 0 ? (
          <div className="api-tokens__empty">
            <p style={{ margin: 0 }}>{t('empty')}</p>
            <p style={{ margin: '4px 0 0' }}>{t('emptyHint')}</p>
          </div>
        ) : desktop ? (
          <div className="api-tokens__scroll">
            <table className="data-table data-table--compact webhooks__table">
              <thead>
                <tr>
                  <th>{t('table.url')}</th>
                  <th>{t('table.events')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.lastDelivery')}</th>
                  <th className="text-right">
                    <span className="oe-sr-only">{t('table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((endpoint) => (
                  <tr key={endpoint.id} data-webhook-id={endpoint.id}>
                    <td className="webhooks__url-cell">
                      <EndpointTitle endpoint={endpoint} />
                    </td>
                    <td className="webhooks__nowrap">{t('eventCount', { count: endpoint.eventTypes.length })}</td>
                    <td>
                      <WebhookStatusPill endpoint={endpoint} />
                    </td>
                    <td className="webhooks__nowrap">
                      <LastDelivery endpoint={endpoint} />
                    </td>
                    <td className="text-right">
                      <EndpointActions endpoint={endpoint} actions={actions} serverDisabled={serverDisabled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="api-tokens__rows">
            {list.map((endpoint) => (
              <li key={endpoint.id} className="webhook-row" data-webhook-id={endpoint.id}>
                <EndpointTitle endpoint={endpoint} />
                <div className="api-token-row__meta">
                  <WebhookStatusPill endpoint={endpoint} />
                  <span>{t('eventCount', { count: endpoint.eventTypes.length })}</span>
                  <span>
                    {t('table.lastDelivery')}: <LastDelivery endpoint={endpoint} />
                  </span>
                </div>
                <div className="webhook-row__actions">
                  <EndpointActions endpoint={endpoint} actions={actions} serverDisabled={serverDisabled} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <div className="app-card">
      <SettingsSectionHead icon="webhook" title={t('title')} description={t('description')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="api-tokens__intro">{t('intro')}</p>
        <div className="api-tokens__links">
          <a href={webhookDocsUrl(locale)} target="_blank" rel="noopener noreferrer" className="notice-link">
            {t('docsLink')}
          </a>
        </div>

        <OrganizationIdField example="webhooks" />

        {body}
      </div>

      {actions.dialogs}
    </div>
  );
}

function EndpointTitle({ endpoint }: { endpoint: WebhookEndpoint }) {
  const t = useTranslations('settings.organizationWebhooks');
  return (
    <span className="webhook-title">
      <Link href={`/settings/webhooks/${endpoint.id}`} className="webhook-title__url" title={endpoint.url}>
        {endpoint.url}
      </Link>
      <span className={`webhook-title__desc${endpoint.description ? '' : ' is-empty'}`}>
        {endpoint.description || t('noDescription')}
      </span>
    </span>
  );
}

function LastDelivery({ endpoint }: { endpoint: WebhookEndpoint }) {
  const t = useTranslations('settings.organizationWebhooks.lastDelivery');
  const { formatDateTime } = useLocaleFormat();
  if (!endpoint.lastDeliveryAt) return <span className="webhook-muted">{t('never')}</span>;
  const failed = endpoint.lastDeliveryStatus === 'failed';
  return (
    <span className="webhook-last">
      <span
        className={`webhook-last__dot${failed ? ' is-failed' : ''}`}
        aria-hidden="true"
      />
      <span>{formatDateTime(endpoint.lastDeliveryAt)}</span>
      {endpoint.lastDeliveryStatus && (
        <span className="webhook-muted">· {t(endpoint.lastDeliveryStatus)}</span>
      )}
    </span>
  );
}

function EndpointActions({
  endpoint,
  actions,
  serverDisabled,
}: {
  endpoint: WebhookEndpoint;
  actions: ReturnType<typeof useWebhookActions>;
  serverDisabled: boolean;
}) {
  const t = useTranslations('settings.organizationWebhooks');
  const label = (action: string) => t('actionLabel', { action: t(`actions.${action}`), url: endpoint.url });
  return (
    <span className="webhook-actions">
      <Link
        href={`/settings/webhooks/${endpoint.id}`}
        className="btn btn--ghost btn--icon btn--sm"
        title={label('deliveries')}
        aria-label={label('deliveries')}
      >
        <Icon name="history" size={16} />
      </Link>
      <WebhookIconButton
        icon="send"
        label={label('test')}
        onClick={() => actions.sendTest(endpoint)}
        disabled={serverDisabled || actions.testPendingId === endpoint.id}
      />
      <WebhookIconButton icon="edit" label={label('edit')} onClick={() => actions.openEdit(endpoint)} />
      <WebhookIconButton icon="refresh" label={label('rotate')} onClick={() => actions.openRotate(endpoint)} />
      <WebhookIconButton icon="trash" label={label('delete')} onClick={() => actions.openDelete(endpoint)} danger />
    </span>
  );
}
