'use client';

import { useLocale, useTranslations } from 'next-intl';

import '@/styles/api-tokens.css';
import '@/styles/webhooks.css';
import '@/styles/admin-table-wave3.css';
import { Banner, Icon, Skeleton, type DataColumn, type RowAction } from '@openeos/ui';

import { AdminTable, CellMain } from '@/components/shared/admin-table';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import { useWebhookInfo, useWebhooks } from '@/hooks/use-webhooks';

import { getPathname, Link, useRouter } from '@/i18n/routing';

import { DEFAULT_MAX_WEBHOOK_ENDPOINTS, webhookDocsUrl, webhookLimitReached } from '@/lib/webhooks';

import { useAuthStore } from '@/stores/auth-store';

import type { WebhookEndpoint } from '@/types/webhook';

import { SettingsSectionHead } from './settings-section-head';
import { OrganizationIdField } from './organization-id-field';
import { useWebhookActions } from './webhook-actions';
import { WebhookStatusPill } from './webhook-ui';

/**
 * Ausgehende Webhooks der Organisation: Liste mit Status und letzter
 * Zustellung, Anlegen und Bearbeiten im Dialog, das Zustellprotokoll auf
 * einer eigenen Seite (/settings/webhooks/[id]). Wie bei den Zugängen
 * sehen nur Admins die Liste; Mitglieder bekommen den Hinweis.
 */
const deliveriesHref = (endpoint: WebhookEndpoint) => `/settings/webhooks/${endpoint.id}`;

export function OrganizationWebhooksSection() {
  const t = useTranslations('settings.organizationWebhooks');
  const locale = useLocale();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const router = useRouter();
  const organizationId = currentOrganization?.organizationId ?? '';

  const info = useWebhookInfo(organizationId || undefined, isAdmin);
  const webhooks = useWebhooks(organizationId || undefined, isAdmin);
  const actions = useWebhookActions(organizationId);

  if (!currentOrganization) return null;

  const list = webhooks.data ?? [];
  const maxEndpoints = info.data?.maxEndpoints ?? DEFAULT_MAX_WEBHOOK_ENDPOINTS;
  const limitReached = webhookLimitReached(list.length, maxEndpoints);
  const serverDisabled = info.data?.enabled === false;

  const label = (endpoint: WebhookEndpoint, action: string) =>
    t('actionLabel', { action: t(`actions.${action}`), url: endpoint.url });

  const columns: DataColumn<WebhookEndpoint>[] = [
    {
      id: 'url',
      header: t('table.url'),
      mobile: 'title',
      cell: (endpoint) => (
        <CellMain
          title={
            <Link href={deliveriesHref(endpoint)} className="webhook-title__url">
              {endpoint.url}
            </Link>
          }
          titleText={endpoint.url}
          sub={
            <span className={endpoint.description ? undefined : 'webhook-title__none'}>
              {endpoint.description || t('noDescription')}
            </span>
          }
          subText={endpoint.description || undefined}
        />
      ),
    },
    {
      id: 'events',
      header: t('table.events'),
      mobile: 'meta',
      className: 'webhooks__nowrap',
      cell: (endpoint) => t('eventCount', { count: endpoint.eventTypes.length }),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (endpoint) => <WebhookStatusPill endpoint={endpoint} />,
    },
    {
      id: 'lastDelivery',
      header: t('table.lastDelivery'),
      mobile: 'meta',
      className: 'webhooks__nowrap',
      cell: (endpoint) => <LastDelivery endpoint={endpoint} />,
    },
  ];

  const rowActions = (endpoint: WebhookEndpoint): RowAction[] => [
    {
      id: 'deliveries',
      label: label(endpoint, 'deliveries'),
      icon: 'history',
      // Ein echter Link (neuer Tab, Adresse kopieren), geöffnet aber im Client.
      href: getPathname({ href: deliveriesHref(endpoint), locale }),
      onClick: (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.push(deliveriesHref(endpoint));
      },
    },
    { id: 'edit', label: label(endpoint, 'edit'), icon: 'edit', onClick: () => actions.openEdit(endpoint) },
    {
      id: 'test',
      label: label(endpoint, 'test'),
      icon: 'send',
      onClick: () => actions.sendTest(endpoint),
      disabled: serverDisabled || actions.testPendingId === endpoint.id,
    },
    { id: 'rotate', label: label(endpoint, 'rotate'), icon: 'refresh', onClick: () => actions.openRotate(endpoint) },
    {
      id: 'delete',
      label: label(endpoint, 'delete'),
      icon: 'trash',
      danger: true,
      onClick: () => actions.openDelete(endpoint),
    },
  ];

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
        ) : (
          <AdminTable
            flush={false}
            className="webhooks-list"
            caption={t('title')}
            rows={list}
            rowKey="id"
            columns={columns}
            actions={rowActions}
            // Zustellungen, Bearbeiten und Test in der Zeile; Secret und Löschen im Menü.
            inlineActions={3}
            onRowClick={(endpoint) => router.push(deliveriesHref(endpoint))}
          />
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
