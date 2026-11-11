'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Icon, Select, type DataColumn } from '@openeos/ui';
import { useInfiniteQuery } from '@tanstack/react-query';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { AdminTable, CellMain, CellNone, CellText } from '@/components/shared/admin-table';

import { useLocaleFormat } from '@/hooks/use-locale-format';

import { adminApi } from '@/lib/api-client';
import { RETENTION_TRIGGERS, nonZeroCounts, type RetentionRunEntry } from '@/lib/privacy';

import '@/styles/admin-table-wave4.css';

const PAGE = 50;

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

  const columns: DataColumn<RetentionRunEntry>[] = [
    {
      id: 'when',
      header: t('table.when'),
      mobile: 'trailing',
      className: 'wave4-date',
      cell: (run) => formatDateTime(run.startedAt),
    },
    {
      id: 'category',
      header: t('table.category'),
      mobile: 'title',
      cell: (run) => (
        <CellMain
          title={label(run.category, 'category')}
          sub={run.reason || undefined}
          subText={run.reason || undefined}
        />
      ),
    },
    {
      id: 'trigger',
      header: t('table.trigger'),
      mobile: 'subtitle',
      cell: (run) => (
        <span className="admin-retention__badges">
          <span className={triggerBadge[run.trigger] ?? 'badge badge--neutral'}>{label(run.trigger, 'trigger')}</span>
          {run.dryRun && <span className="badge badge--neutral">{t('dryRun')}</span>}
          {run.status === 'failed' && (
            <span className="badge badge--error" title={run.error ?? undefined}>
              {t('failed')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'organization',
      header: t('table.organization'),
      mobile: 'meta',
      cell: (run) => {
        const name = run.organizationName ?? (run.organizationId ? run.organizationId.slice(0, 8) : null);
        return name ? <CellText title={name}>{name}</CellText> : <CellNone />;
      },
    },
    {
      id: 'executedBy',
      header: t('table.executedBy'),
      mobile: 'meta',
      priority: 2,
      cell: (run) =>
        run.executedBy ? (
          <span className="wave4-stack">
            <span>{run.executedBy.name}</span>
            <span className="wave4-stack__line" title={run.executedBy.email}>
              {run.executedBy.email}
            </span>
          </span>
        ) : (
          <CellNone />
        ),
    },
    {
      id: 'counts',
      header: t('table.counts'),
      mobile: 'meta',
      cell: (run) => {
        const counts = nonZeroCounts(run.counts);
        return counts.length === 0 ? (
          <span className="admin-cell-none">{t('nothing')}</span>
        ) : (
          <span className="wave4-stack admin-retention__counts">
            {counts.map(([key, n]) => (
              <span key={key} className="tse-mono">
                {key}: {n}
              </span>
            ))}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-card app-card--flat" style={{ paddingBottom: 0 }}>
        <div className="app-card__head" style={{ borderBottom: 'none', flexWrap: 'wrap', gap: 12 }}>
          <div className="admin-retention__filter">
            <span aria-hidden>{t('filter')}</span>
            <Select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              aria-label={t('filter')}
              data-testid="admin-retention-filter"
            >
              {['', ...RETENTION_TRIGGERS].map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? label(value, 'trigger') : t('all')}
                </option>
              ))}
            </Select>
          </div>
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
        <div className="app-card app-card--flat" data-testid="admin-retention-table">
          <AdminTable
            caption={t('title')}
            rows={runs}
            rowKey="id"
            columns={columns}
            footer={
              query.hasNextPage ? (
                <div className="admin-retention__more">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {t('loadMore')}
                  </button>
                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
