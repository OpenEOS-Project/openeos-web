'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Webhook } from 'lucide-react';

import '@/styles/api-tokens.css';
import '@/styles/webhooks.css';
import '@/styles/admin-table-wave3.css';
import {
  Banner,
  Icon,
  Select,
  Skeleton,
  useMediaQuery,
  type DataColumn,
  type RowAction,
} from '@openeos/ui';

import {
  AdminFilterBar,
  AdminPager,
  AdminTable,
  ListAction,
  ListHead,
  PHONE_QUERY,
} from '@/components/shared/admin-table';

import { DetailPageHead } from '@/components/shared/detail-page-head';
import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useUpdateWebhook,
  useWebhook,
  useWebhookDeliveries,
  useWebhookInfo,
} from '@/hooks/use-webhooks';

import { Link, useRouter } from '@/i18n/routing';

import { WEBHOOK_DELIVERIES_PAGE_SIZE } from '@/lib/webhooks';

import { useAuthStore } from '@/stores/auth-store';

import { ApiException } from '@/types/api';
import {
  WEBHOOK_DELIVERY_STATUSES,
  type WebhookDelivery,
  type WebhookDeliveryEventType,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
} from '@/types/webhook';

import { useWebhookActions } from '../../components/webhook-actions';
import {
  DeliveryStatusPill,
  EventTypeCode,
  useDeliveryErrorLabel,
  useDurationLabel,
  useEventTypeLabel,
  WebhookStatusPill,
} from '../../components/webhook-ui';
import { WebhookDeliveryDialog } from './webhook-delivery-dialog';

const BACK_HREF = '/settings?tab=org-webhooks';

/**
 * Ein Webhook mit seinem Zustellprotokoll: oben Adresse, Status und
 * Aktionen, darunter Ereignisse und Secret, dann die Zustellungen mit
 * Filter, Seiten und Detaildialog (Inhalt, Antwort, Versuche, erneut senden).
 */
export function WebhookDeliveriesView() {
  const { webhookId } = useParams<{ webhookId: string }>();
  const t = useTranslations('settings.organizationWebhooks');
  const tD = useTranslations('settings.organizationWebhooks.deliveries');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const organizationId = currentOrganization?.organizationId ?? '';

  const info = useWebhookInfo(organizationId || undefined, isAdmin);
  const webhook = useWebhook(organizationId || undefined, webhookId, isAdmin);
  const update = useUpdateWebhook(organizationId);
  const actions = useWebhookActions(organizationId, { onDeleted: () => router.push(BACK_HREF) });

  const head = (endpoint?: WebhookEndpoint) => (
    <DetailPageHead
      backHref={BACK_HREF}
      backLabel={tD('back')}
      icon={<Webhook />}
      title={endpoint?.description || tD('title')}
      meta={endpoint ? <span className="webhook-head__url">{endpoint.url}</span> : undefined}
      badges={endpoint ? <WebhookStatusPill endpoint={endpoint} /> : undefined}
      actions={
        endpoint ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => actions.sendTest(endpoint)}
              disabled={info.data?.enabled === false || actions.testPendingId === endpoint.id}
            >
              <Icon name="send" size={16} />
              {t('actions.test')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => actions.openEdit(endpoint)}>
              <Icon name="edit" size={16} />
              {t('actions.edit')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => actions.openRotate(endpoint)}>
              <Icon name="refresh" size={16} />
              {t('actions.rotate')}
            </button>
            <button
              type="button"
              className="btn btn--ghost webhook-action--danger"
              onClick={() => actions.openDelete(endpoint)}
            >
              <Icon name="trash" size={16} />
              {t('actions.delete')}
            </button>
          </>
        ) : undefined
      }
    />
  );

  if (!currentOrganization) return null;

  if (!isAdmin) {
    return (
      <div className="webhook-page">
        {head()}
        <Banner tone="info" icon={<Icon name="lock" />}>
          {t('adminOnly')}
        </Banner>
      </div>
    );
  }

  if (webhook.isLoading) {
    return (
      <div className="webhook-page">
        {head()}
        <Skeleton height={160} />
      </div>
    );
  }

  if (webhook.isError || !webhook.data) {
    const notFound = webhook.error instanceof ApiException && webhook.error.status === 404;
    return (
      <div className="webhook-page">
        {head()}
        <Banner tone="danger" icon={<Icon name="alert" />}>
          {notFound ? tD('notFound') : apiErrorMessage(webhook.error, tD('loadError'))}
        </Banner>
        <Link href={BACK_HREF} className="notice-link" style={{ fontSize: 13 }}>
          {tD('back')}
        </Link>
      </div>
    );
  }

  const endpoint = webhook.data;

  const reactivate = () =>
    update.mutate(
      { id: endpoint.id, input: { active: true } },
      {
        onSuccess: () => toast.success(tD('autoDisabled.reactivated')),
        onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
      }
    );

  return (
    <div className="webhook-page">
      {head(endpoint)}

      {info.data?.enabled === false && (
        <Banner tone="warn" icon={<Icon name="alert" />} title={t('disabled.title')}>
          {t('disabled.text')}
        </Banner>
      )}

      {endpoint.disabledReason && !endpoint.active && (
        <AutoDisabledBanner endpoint={endpoint} pending={update.isPending} onReactivate={reactivate} />
      )}

      <EndpointSummary endpoint={endpoint} />

      <DeliveriesCard organizationId={organizationId} endpoint={endpoint} />

      {actions.dialogs}
    </div>
  );
}

function AutoDisabledBanner({
  endpoint,
  pending,
  onReactivate,
}: {
  endpoint: WebhookEndpoint;
  pending: boolean;
  onReactivate: () => void;
}) {
  const t = useTranslations('settings.organizationWebhooks.deliveries.autoDisabled');
  const { formatDateTime } = useLocaleFormat();
  return (
    <Banner tone="danger" icon={<Icon name="alert" />} title={t('title')}>
      <span className="webhook-banner-body">
        <span>{t('text', { date: formatDateTime(endpoint.failingSince ?? endpoint.disabledAt) })}</span>
        <button type="button" className="btn btn--sm btn--primary" onClick={onReactivate} disabled={pending}>
          {t('reactivate')}
        </button>
      </span>
    </Banner>
  );
}

function EndpointSummary({ endpoint }: { endpoint: WebhookEndpoint }) {
  const t = useTranslations('settings.organizationWebhooks.deliveries.endpoint');
  const { formatDate, formatDateTime } = useLocaleFormat();
  const { currentOrganization } = useAuthStore();
  const info = useWebhookInfo(currentOrganization?.organizationId);
  const eventLabel = useEventTypeLabel(info.data?.eventTypes);
  const options = [
    endpoint.includeGuestData ? t('guestData') : null,
    endpoint.includeTestOrders ? t('testOrders') : null,
  ].filter(Boolean);
  const creator = endpoint.createdBy
    ? `${endpoint.createdBy.firstName} ${endpoint.createdBy.lastName}`.trim()
    : null;

  return (
    <div className="app-card webhook-summary">
      <dl className="webhook-facts">
        <div className="webhook-facts__row webhook-facts__row--wide">
          <dt>{t('events')}</dt>
          <dd>
            <ul className="api-token__scopes">
              {endpoint.eventTypes.map((type) => (
                <li key={type}>
                  <span className="api-token__scope" title={eventLabel(type)}>
                    {type}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="webhook-facts__row">
          <dt>{t('secret')}</dt>
          <dd>
            <span className="api-token__prefix">{endpoint.secretHint}</span>
            {endpoint.previousSecretExpiresAt && (
              <small className="webhook-muted webhook-facts__sub">
                {t('previousSecret', { date: formatDateTime(endpoint.previousSecretExpiresAt) })}
              </small>
            )}
          </dd>
        </div>
        <div className="webhook-facts__row">
          <dt>{t('options')}</dt>
          <dd>{options.length > 0 ? options.join(' · ') : t('noOptions')}</dd>
        </div>
        <div className="webhook-facts__row">
          <dt>{t('lastSuccess')}</dt>
          <dd>{formatDateTime(endpoint.lastSuccessAt)}</dd>
        </div>
        <div className="webhook-facts__row">
          <dt>{t('created')}</dt>
          <dd>
            {creator
              ? t('createdBy', { date: formatDate(endpoint.createdAt), name: creator })
              : t('createdOn', { date: formatDate(endpoint.createdAt) })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DeliveriesCard({ organizationId, endpoint }: { organizationId: string; endpoint: WebhookEndpoint }) {
  const t = useTranslations('settings.organizationWebhooks.deliveries');
  const phone = useMediaQuery(PHONE_QUERY);
  const { formatDateTime } = useLocaleFormat();
  const info = useWebhookInfo(organizationId);
  const eventLabel = useEventTypeLabel(info.data?.eventTypes);
  const errorLabel = useDeliveryErrorLabel();
  const durationLabel = useDurationLabel();

  const [status, setStatus] = useState<WebhookDeliveryStatus | ''>('');
  const [eventType, setEventType] = useState<WebhookDeliveryEventType | ''>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WebhookDelivery | null>(null);

  const query = {
    ...(status ? { status } : {}),
    ...(eventType ? { eventType } : {}),
    page,
    limit: WEBHOOK_DELIVERIES_PAGE_SIZE,
  };
  const deliveries = useWebhookDeliveries(organizationId, endpoint.id, query);
  const meta = deliveries.data?.meta;
  const rows = deliveries.data?.data ?? [];

  // Schrumpft die Liste (Filter, Aufbewahrung), zurück auf die letzte Seite.
  useEffect(() => {
    if (meta && meta.totalPages >= 1 && page > meta.totalPages) setPage(meta.totalPages);
  }, [meta, page]);

  const filtered = !!status || !!eventType;
  const eventOptions: WebhookDeliveryEventType[] = [...(info.data?.eventTypes.map((e) => e.type) ?? []), 'ping'];

  const showDetails = (delivery: WebhookDelivery) => setSelected(delivery);
  const detailsLabel = (delivery: WebhookDelivery) =>
    t('showDetails', { event: delivery.eventType, time: formatDateTime(delivery.createdAt) });

  const columns: DataColumn<WebhookDelivery>[] = [
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (delivery) => <DeliveryStatusPill status={delivery.status} />,
    },
    {
      id: 'event',
      header: t('table.event'),
      mobile: 'title',
      className: 'webhook-deliveries__event',
      cell: (delivery) => {
        const error = errorLabel(delivery.error);
        return (
          <span className="webhook-deliveries__event-cell">
            <span className="webhook-deliveries__event-line">
              <EventTypeCode type={delivery.eventType} label={eventLabel(delivery.eventType)} />
              {delivery.manual && <span className="webhook-muted"> · {t('manual')}</span>}
            </span>
            {/* Auch auf dem Telefon unter dem Ereignis (Zeile 1 des Eintrags). */}
            {error && (
              <span className="webhook-deliveries__error" title={error}>
                {error}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: 'http',
      header: t('table.http'),
      num: true,
      priority: 2,
      cell: (delivery) => delivery.responseStatus ?? '—',
    },
    {
      id: 'duration',
      header: t('table.duration'),
      num: true,
      priority: 3,
      cell: (delivery) => durationLabel(delivery.durationMs),
    },
    {
      id: 'attempts',
      header: t('table.attempts'),
      num: true,
      mobile: 'meta',
      cell: (delivery) => t('attempts', { attempts: delivery.attempts, max: delivery.maxAttempts }),
    },
    {
      id: 'nextAttempt',
      header: t('table.nextAttempt'),
      num: true,
      priority: 3,
      cell: (delivery) => formatDateTime(delivery.nextAttemptAt),
    },
    {
      id: 'time',
      header: t('table.time'),
      num: true,
      mobile: 'meta',
      cell: (delivery) => formatDateTime(delivery.createdAt),
    },
  ];

  /* Die ganze Zeile öffnet die Details; der Knopf bleibt für Tastatur und
     Screenreader. Auf dem Telefon reicht das Tippen auf den Eintrag. */
  const rowActions = (delivery: WebhookDelivery): RowAction[] => [
    {
      id: 'details',
      label: detailsLabel(delivery),
      icon: 'chevron-right',
      hidden: phone,
      onClick: () => showDetails(delivery),
    },
  ];

  return (
    <div className="app-card app-card--flat webhook-deliveries">
      <ListHead
        actions={
          <ListAction
            icon={<Icon name="refresh" className={deliveries.isFetching ? 'admin-spin' : undefined} />}
            label={t('refresh')}
            onClick={() => deliveries.refetch()}
            disabled={deliveries.isFetching}
          />
        }
      >
        <h2 className="webhook-deliveries__title">{t('title')}</h2>
        {info.data && (
          <p className="api-tokens__count">
            {t('retention', { days: info.data.retentionDays, attempts: info.data.maxAttempts })}
          </p>
        )}
      </ListHead>

      {/* Auf dem Telefon stehen die Filter im Sheet, dort mit Beschriftung. */}
      <AdminFilterBar
        activeCount={[status, eventType].filter(Boolean).length}
        onReset={() => {
          setStatus('');
          setEventType('');
          setPage(1);
        }}
        actions={
          meta && rows.length > 0 ? (
            <span className="api-tokens__count webhook-deliveries__count">{t('count', { count: meta.total })}</span>
          ) : undefined
        }
      >
        <Select
          label={phone ? t('filterStatus') : undefined}
          aria-label={t('filterStatus')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as WebhookDeliveryStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          {WEBHOOK_DELIVERY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </Select>
        <Select
          label={phone ? t('filterEvent') : undefined}
          aria-label={t('filterEvent')}
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value as WebhookDeliveryEventType | '');
            setPage(1);
          }}
        >
          <option value="">{t('allEvents')}</option>
          {eventOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </AdminFilterBar>

      {deliveries.isLoading ? (
        <div className="webhook-deliveries__state">
          <Skeleton height={120} />
        </div>
      ) : deliveries.isError ? (
        <div className="webhook-deliveries__state">
          <Banner tone="danger" icon={<Icon name="alert" />}>
            {t('loadError')}
          </Banner>
        </div>
      ) : rows.length === 0 ? (
        <p className="api-tokens__empty webhook-deliveries__state">{filtered ? t('emptyFiltered') : t('empty')}</p>
      ) : (
        <AdminTable
          className="webhook-deliveries__table"
          caption={t('title')}
          rows={rows}
          rowKey="id"
          columns={columns}
          actions={rowActions}
          onRowClick={showDetails}
          loading={deliveries.isPlaceholderData && deliveries.isFetching}
          footer={
            meta && meta.totalPages > 1 ? (
              <AdminPager
                page={meta.page}
                pageSize={WEBHOOK_DELIVERIES_PAGE_SIZE}
                total={meta.total}
                onChange={(next) => setPage(next)}
              />
            ) : undefined
          }
        />
      )}

      {selected && (
        <WebhookDeliveryDialog
          organizationId={organizationId}
          webhookId={endpoint.id}
          delivery={selected}
          redeliverDisabled={info.data?.enabled === false}
          onClose={() => setSelected(null)}
          onRedelivered={() => {
            setSelected(null);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
