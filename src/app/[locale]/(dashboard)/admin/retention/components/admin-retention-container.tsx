'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Icon } from '@openeos/ui';
import { useInfiniteQuery } from '@tanstack/react-query';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';

import { useLocaleFormat } from '@/hooks/use-locale-format';

import { adminApi } from '@/lib/api-client';
import { RETENTION_TRIGGERS, nonZeroCounts, type RetentionRunEntry } from '@/lib/privacy';

const PAGE = 50;
const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

const triggerBadge: Record<RetentionRunEntry['trigger'], string> = {
  scheduled: 'badge badge--neutral',
  manual: 'badge badge--neutral',
  instruction: 'badge badge--info',
  club: 'badge badge--warning',
  self_service: 'badge badge--info',
};

/**
 * Protokoll der Löschungen für den Super-Admin (Löschkonzept 1.5/5.3):
 * nächtliche Läufe, Läufe von Hand, Einzellöschungen auf Weisung und
 * Löschungen durch die Vereine bzw. Benutzer selbst – mit Zeitpunkt,
 * Datenart, Zahlen und ausführender Person, ohne Inhalte.
 */
export function AdminRetentionContainer() {
  const t = useTranslations('admin.retention');
  const { formatDateTime } = useLocaleFormat();
  const [trigger, setTrigger] = useState<string>('');

  const query = useInfiniteQuery({
    queryKey: ['admin', 'retention', 'runs', trigger],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      adminApi.listRetentionRuns({ trigger: trigger || undefined, limit: PAGE, offset: pageParam }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.data.length, 0);
      return loaded < last.meta.total ? loaded : undefined;
    },
  });

  const runs = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? 0;
  const label = (key: string, group: 'category' | 'trigger') =>
    t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-card app-card--flat" style={{ paddingBottom: 0 }}>
        <div className="app-card__head" style={{ borderBottom: 'none', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span>{t('filter')}</span>
            <select
              className="select"
              style={{ width: 'auto', minWidth: 200 }}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              data-testid="admin-retention-filter"
            >
              {['', ...RETENTION_TRIGGERS].map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? label(value, 'trigger') : t('all')}
                </option>
              ))}
            </select>
          </label>
          {query.data && (
            <p className="app-card__sub" style={{ margin: 0 }}>
              {t('shown', { shown: runs.length, total })}
            </p>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <ListLoading />
      ) : query.isError ? (
        <ListError onRetry={() => query.refetch()} />
      ) : runs.length === 0 ? (
        <ListEmpty title={t('empty.title')} description={t('empty.description')} icon={<Icon name="trash" size={28} />} />
      ) : (
        <div className="app-card app-card--flat">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" data-testid="admin-retention-table">
              <thead>
                <tr>
                  <th>{t('table.when')}</th>
                  <th>{t('table.category')}</th>
                  <th>{t('table.trigger')}</th>
                  <th>{t('table.organization')}</th>
                  <th>{t('table.executedBy')}</th>
                  <th>{t('table.counts')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const counts = nonZeroCounts(run.counts);
                  return (
                    <tr key={run.id} data-testid="admin-retention-row">
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(run.startedAt)}</td>
                      <td>
                        {label(run.category, 'category')}
                        {run.reason && (
                          <div style={{ fontSize: 12, color: MUTED, maxWidth: 260 }}>{run.reason}</div>
                        )}
                      </td>
                      <td>
                        <span className={triggerBadge[run.trigger] ?? 'badge badge--neutral'}>
                          {label(run.trigger, 'trigger')}
                        </span>
                        {run.dryRun && (
                          <span className="badge badge--neutral" style={{ marginLeft: 6 }}>
                            {t('dryRun')}
                          </span>
                        )}
                        {run.status === 'failed' && (
                          <span className="badge badge--error" style={{ marginLeft: 6 }} title={run.error ?? undefined}>
                            {t('failed')}
                          </span>
                        )}
                      </td>
                      <td>{run.organizationName ?? (run.organizationId ? run.organizationId.slice(0, 8) : '–')}</td>
                      <td>
                        {run.executedBy ? (
                          <>
                            {run.executedBy.name}
                            <div style={{ fontSize: 12, color: MUTED }}>{run.executedBy.email}</div>
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {counts.length === 0 ? (
                          <span style={{ color: MUTED }}>{t('nothing')}</span>
                        ) : (
                          counts.map(([key, n]) => (
                            <div key={key} className="tse-mono">
                              {key}: {n}
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {query.hasNextPage && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t('loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
