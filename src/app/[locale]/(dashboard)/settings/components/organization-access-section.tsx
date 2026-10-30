'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import '@/styles/api-tokens.css';
import { Banner, Icon, Skeleton } from '@openeos/ui';

import { toast } from '@/components/shared/toast';

import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useBreakpoint } from '@/hooks/use-breakpoint';
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

/**
 * Zugänge der Organisation (ki-plan.md Abschnitt 8): API-Tokens, mit denen
 * andere Programme oder ein Assistent die Verwaltung bedienen — nie die
 * Kasse. Nur Admins sehen die Liste und legen Zugänge an; Mitglieder
 * bekommen den Hinweis. Der Klartext erscheint genau einmal nach dem
 * Anlegen (Dialog); hier steht nur das Präfix.
 */
export function OrganizationAccessSection() {
  const t = useTranslations('settings.organizationAccess');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { currentOrganization } = useAuthStore();
  const { isAdmin } = usePermissions();
  const { formatDate } = useLocaleFormat();
  /* Ab Tablet-Breite die dichte Tabelle, darunter kompakte Zeilen — nichts
     soll seitlich scrollen. */
  const desktop = useBreakpoint('md');
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
        ) : desktop ? (
          <div className="api-tokens__scroll">
            <table className="data-table data-table--compact api-tokens__table">
              <thead>
                <tr>
                  <th>{t('table.name')}</th>
                  <th>{t('table.key')}</th>
                  <th>{t('table.scopes')}</th>
                  <th>{t('table.created')}</th>
                  <th>{t('table.lastUsed')}</th>
                  <th>{t('table.expires')}</th>
                  <th className="text-right">
                    <span className="oe-sr-only">{t('table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((token) => {
                  const status = apiTokenStatus(token);
                  return (
                    <tr
                      key={token.id}
                      className={status === 'active' ? undefined : 'api-token--inactive'}
                      data-status={status}
                    >
                      <td>
                        <span className="api-token__stack">
                          <span className="api-token__title">
                            <span className="api-token__name">{token.name}</span>
                            <StatusBadge status={status} />
                          </span>
                          {/* Unter 1024px rückt der Schlüssel unter den Namen,
                              die eigene Spalte verschwindet (CSS). */}
                          <span className="api-token__prefix api-token__prefix--sub" title={t('prefixTitle')}>
                            {apiTokenPreview(token.tokenPrefix)}
                          </span>
                        </span>
                      </td>
                      <td className="api-token__prefix api-token__prefix--col" title={t('prefixTitle')}>
                        {apiTokenPreview(token.tokenPrefix)}
                      </td>
                      <td className="api-token__scopes-cell">
                        <ScopeChips scopes={token.scopes} />
                      </td>
                      <td>
                        <span className="api-token__created">
                          <span>{formatDate(token.createdAt)}</span>
                          <small>{creatorName(token, t('meta.unknownUser'))}</small>
                        </span>
                      </td>
                      <td className="api-token__date">
                        {token.lastUsedAt ? formatDate(token.lastUsedAt) : t('meta.never')}
                      </td>
                      <td className="api-token__date">
                        {token.expiresAt ? formatDate(token.expiresAt) : t('meta.never')}
                      </td>
                      <td className="text-right">
                        {status === 'active' && (
                          <RevokeButton label={t('revokeTitle', { name: token.name })} onClick={() => setRevokeTarget(token)} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="api-tokens__rows">
            {sorted.map((token) => {
              const status = apiTokenStatus(token);
              return (
                <li
                  key={token.id}
                  className={`api-token-row${status === 'active' ? '' : ' api-token--inactive'}`}
                  data-status={status}
                >
                  <div className="api-token-row__main">
                    <div className="api-token-row__head">
                      <span className="api-token__name">{token.name}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="api-token-row__meta">
                      <span className="api-token__prefix" title={t('prefixTitle')}>
                        {apiTokenPreview(token.tokenPrefix)}
                      </span>
                      <ScopeChips scopes={token.scopes} />
                      <span className="api-token-row__used">
                        {t('table.lastUsed')}:{' '}
                        {token.lastUsedAt ? formatDate(token.lastUsedAt) : t('meta.never')}
                      </span>
                    </div>
                  </div>
                  {status === 'active' && (
                    <div className="api-token-row__actions">
                      <RevokeButton label={t('revokeTitle', { name: token.name })} onClick={() => setRevokeTarget(token)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
        <p className="api-tokens__intro">{t('intro')}</p>
        <div className="api-tokens__links">
          <a
            href={apiDocsUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="cash-tse-notice__link"
          >
            {t('docsLink')}
          </a>
          <a
            href={agentDocsUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="cash-tse-notice__link"
          >
            {t('agentDocsLink')}
          </a>
        </div>

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

/** Nur das Symbol; der Name steht im Tooltip und für Screenreader. */
function RevokeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon btn--sm api-token__revoke"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name="ban" size={16} />
    </button>
  );
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
