'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import '@/styles/api-tokens.css';
import '@/styles/admin-table-wave3.css';
import { Banner, Icon, Skeleton, type DataColumn, type RowAction } from '@openeos/ui';

import { AdminTable, CellMain } from '@/components/shared/admin-table';

import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useApiTokens, useRevokeApiToken } from '@/hooks/use-api-tokens';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { usePermissions } from '@/hooks/use-permissions';

import {
  agentDocsUrl,
  apiDocsUrl,
  apiTokenLimitReached,
  apiTokenPreview,
  apiTokenStatus,
  countActiveApiTokens,
  MAX_ACTIVE_API_TOKENS,
  sortApiTokens,
} from '@/lib/api-tokens';

import { useAuthStore } from '@/stores/auth-store';

import type { ApiToken, ApiTokenScope } from '@/types/api-token';

import { ApiTokenCreateDialog } from './api-token-create-dialog';
import { ApiTokenRevokeDialog } from './api-token-revoke-dialog';
import { SettingsSectionHead } from './settings-section-head';
import { OrganizationIdField } from './organization-id-field';

/**
 * Zugänge der Organisation (ki-plan.md Abschnitt 8): API-Tokens, mit denen
 * andere Programme oder ein Assistent die Verwaltung bedienen — nie die
 * Kasse. Nur Admins sehen die Liste und legen Zugänge an; Mitglieder
 * bekommen den Hinweis. Der Klartext erscheint genau einmal nach dem
 * Anlegen (Dialog); hier steht nur das Präfix.
 */
export function OrganizationAccessSection({ onShowWebhooks }: { onShowWebhooks?: () => void } = {}) {
  const t = useTranslations('settings.organizationAccess');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const { formatDate } = useLocaleFormat();
  const organizationId = currentOrganization?.organizationId ?? '';

  const tokens = useApiTokens(organizationId || undefined, isAdmin);
  const revoke = useRevokeApiToken(organizationId);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  if (!currentOrganization) return null;

  const onRevoke = (token: ApiToken) => {
    revoke.mutate(token.id, {
      onSuccess: () => {
        setRevokeTarget(null);
        toast.success(t('revoked', { name: token.name }));
      },
      onError: (err) => toast.error(apiErrorMessage(err, tCommon('error'))),
    });
  };

  const list = tokens.data ?? [];
  const sorted = sortApiTokens(list);
  const activeCount = countActiveApiTokens(list);
  const limitReached = apiTokenLimitReached(list);

  const columns: DataColumn<ApiToken>[] = [
    {
      id: 'name',
      header: t('table.name'),
      mobile: 'title',
      cell: (token) => (
        <CellMain
          title={token.name}
          titleText={token.name}
          sub={
            <span className="api-token__prefix" title={t('prefixTitle')}>
              {apiTokenPreview(token.tokenPrefix)}
            </span>
          }
        />
      ),
    },
    {
      id: 'status',
      header: t('table.status'),
      mobile: 'subtitle',
      cell: (token) => <StatusBadge status={apiTokenStatus(token)} />,
    },
    {
      id: 'scopes',
      header: t('table.scopes'),
      mobile: 'meta',
      className: 'api-tokens-list__scopes',
      cell: (token) => <ScopeChips scopes={token.scopes} />,
    },
    {
      id: 'created',
      header: t('table.created'),
      priority: 3,
      cell: (token) => (
        <span className="api-token__created">
          <span>{formatDate(token.createdAt)}</span>
          <small>{creatorName(token, t('meta.unknownUser'))}</small>
        </span>
      ),
    },
    {
      id: 'lastUsed',
      header: t('table.lastUsed'),
      mobile: 'meta',
      className: 'api-token__date',
      cell: (token) => (
        <>
          {/* Telefon: ohne Spaltenkopf braucht das Datum eine Beschriftung. */}
          <span className="api-tokens-list__phone-label">{t('table.lastUsed')}: </span>
          {token.lastUsedAt ? formatDate(token.lastUsedAt) : t('meta.never')}
        </>
      ),
    },
    {
      id: 'expires',
      header: t('table.expires'),
      className: 'api-token__date',
      cell: (token) => (token.expiresAt ? formatDate(token.expiresAt) : t('meta.never')),
    },
  ];

  const rowActions = (token: ApiToken): RowAction[] => [
    {
      id: 'revoke',
      label: t('revokeTitle', { name: token.name }),
      icon: 'ban',
      danger: true,
      hidden: apiTokenStatus(token) !== 'active',
      onClick: () => setRevokeTarget(token),
    },
  ];

  let body: React.ReactNode;
  if (!isAdmin) {
    body = (
      <Banner tone="info" icon={<Icon name="lock" />}>
        {t('adminOnly')}
      </Banner>
    );
  } else if (tokens.isLoading) {
    body = <Skeleton height={96} />;
  } else if (tokens.isError) {
    body = (
      <Banner tone="danger" icon={<Icon name="alert" />}>
        {t('loadError')}
      </Banner>
    );
  } else {
    body = (
      <>
        <div className="api-tokens__toolbar">
          <p className="api-tokens__count">
            {t('count', { active: activeCount, limit: MAX_ACTIVE_API_TOKENS })}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setCreateOpen(true)}
            disabled={limitReached}
          >
            <Icon name="plus" />
            {t('create')}
          </button>
        </div>

        {limitReached && (
          <Banner tone="warn" icon={<Icon name="alert" />} title={t('limit.title')}>
            {t('limit.text', { limit: MAX_ACTIVE_API_TOKENS })}
          </Banner>
        )}

        {list.length === 0 ? (
          <p className="api-tokens__empty">{t('empty')}</p>
        ) : (
          <AdminTable
            flush={false}
            className="api-tokens-list"
            caption={t('title')}
            rows={sorted}
            rowKey="id"
            columns={columns}
            actions={rowActions}
            rowClassName={(token) => (apiTokenStatus(token) === 'active' ? undefined : 'admin-dt__row--muted')}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-card">
      <SettingsSectionHead icon="key-square" title={t('title')} description={t('description')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="api-tokens__intro">{t('intro')}</p>
        <div className="api-tokens__links">
          <a
            href={apiDocsUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-link"
          >
            {t('docsLink')}
          </a>
          <a
            href={agentDocsUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-link"
          >
            {t('agentDocsLink')}
          </a>
          {/* Webhooks stehen im Reiter daneben; ihre Token-Scopes hier. */}
          {onShowWebhooks && (
            <button type="button" className="notice-link api-tokens__link-button" onClick={onShowWebhooks}>
              {t('webhooksLink')}
            </button>
          )}
        </div>

        <OrganizationIdField example="tokens" />

        {body}
      </div>

      {createOpen && (
        <ApiTokenCreateDialog organizationId={organizationId} onClose={() => setCreateOpen(false)} />
      )}

      {revokeTarget && (
        <ApiTokenRevokeDialog
          token={revokeTarget}
          pending={revoke.isPending}
          onConfirm={() => onRevoke(revokeTarget)}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}

function creatorName(token: ApiToken, fallback: string): string {
  if (!token.createdBy) return fallback;
  return `${token.createdBy.firstName} ${token.createdBy.lastName}`.trim();
}

function ScopeChips({ scopes }: { scopes: ApiTokenScope[] }) {
  const t = useTranslations('settings.organizationAccess');
  return (
    <ul className="api-token__scopes" aria-label={t('scopes')}>
      {scopes.map((scope) => (
        <li key={scope}>
          <ScopeChip scope={scope} />
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: 'active' | 'expired' | 'revoked' }) {
  const t = useTranslations('settings.organizationAccess.status');
  const tone = status === 'active' ? 'badge--success' : 'badge--neutral';
  return <span className={`badge ${tone}`}>{t(status)}</span>;
}

/** Kurzname im Chip, die Beschreibung als Tooltip. */
export function ScopeChip({ scope }: { scope: ApiTokenScope }) {
  const t = useTranslations('settings.organizationAccess.scopeLabels');
  const tDesc = useTranslations('settings.organizationAccess.scopeDescriptions');
  const write = scope.endsWith(':write');
  return (
    <span
      className={`api-token__scope${write ? ' api-token__scope--write' : ''}`}
      title={tDesc.has(scope) ? tDesc(scope) : undefined}
    >
      {t.has(scope) ? t(scope) : scope}
    </span>
  );
}
