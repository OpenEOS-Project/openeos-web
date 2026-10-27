'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Icon } from '@openeos/ui';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { adminApi } from '@/lib/api-client';
import type { AdminPrinterOverviewAgent, Printer } from '@/types/printer';
import { formatAgentInfo, formatPrinterConnection } from '@/utils/printer-connection';
import { formatTimeAgo } from '@/utils/time-ago';

const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

const typeBadgeClass: Record<string, string> = {
  receipt: 'badge badge--info',
  kitchen: 'badge badge--warning',
  label: 'badge badge--neutral',
};

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: online ? 'var(--green-ink)' : 'color-mix(in oklab, var(--ink) 30%, transparent)',
        boxShadow: online ? '0 0 0 3px color-mix(in oklab, var(--green-ink) 18%, transparent)' : undefined,
      }}
    />
  );
}

/**
 * Read-only overview for platform admins: every printer agent, grouped by
 * organisation, with the printers it serves. Pairing, adopting and editing
 * happen in the organisation's own "Drucker" page; the only action left
 * here is a test print as a support tool.
 */
export function AdminPrintersContainer() {
  const t = useTranslations('admin.printers');
  const tPrinters = useTranslations('printers');
  const apiErrorMessage = useApiErrorMessage();
  const { locale, formatDateTime } = useLocaleFormat();
  const [search, setSearch] = useState('');

  const overviewQuery = useQuery({
    queryKey: ['admin', 'printers'],
    queryFn: async () => (await adminApi.listPrinters()).data,
    // Agents heartbeat every 30 s; 10 s keeps the online column close to live.
    refetchInterval: 10_000,
  });

  const testPrintMutation = useMutation({
    mutationFn: (printerId: string) => adminApi.testPrintPrinter(printerId),
    onSuccess: (response) => {
      const result = response.data;
      if (result.success) toast.success(result.message ?? t('toast.testPrintSent'));
      else toast.error(result.message ?? t('toast.testPrintNotPossible'));
    },
    onError: (err: Error) => toast.error(t('toast.testPrintFailed', { message: apiErrorMessage(err) })),
  });

  const entries = useMemo(() => {
    const all = overviewQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (entry) =>
        (entry.organization?.name ?? '').toLowerCase().includes(needle) ||
        entry.agents.some(
          (agent) =>
            agent.name.toLowerCase().includes(needle) ||
            (agent.agentInfo?.hostname ?? '').toLowerCase().includes(needle) ||
            agent.printers.some((p) => p.name.toLowerCase().includes(needle)),
        ),
    );
  }, [overviewQuery.data, search]);

  if (overviewQuery.isLoading) return <ListLoading />;
  if (overviewQuery.isError) return <ListError onRetry={() => overviewQuery.refetch()} />;

  const totals = (overviewQuery.data ?? []).reduce(
    (acc, entry) => {
      acc.agents += entry.agents.length;
      acc.online += entry.agents.filter((a) => a.isOnline).length;
      acc.printers += entry.agents.reduce((n, a) => n + a.printers.length, 0);
      return acc;
    },
    { agents: 0, online: 0, printers: 0 },
  );

  if ((overviewQuery.data ?? []).length === 0) {
    return (
      <ListEmpty title={t('empty.title')} description={t('empty.description')} icon={<Icon name="printer" size={28} />} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="app-card app-card--flat" style={{ paddingBottom: 0 }}>
        <div className="app-card__head" style={{ borderBottom: 'none', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="app-card__title">{t('summary.title')}</h2>
            <p className="app-card__sub">
              {t('summary.agents', { count: totals.agents, online: totals.online })} ·{' '}
              {tPrinters('printerCount', { count: totals.printers })}
            </p>
          </div>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </div>
      </div>

      {entries.length === 0 && (
        <div className="app-card" style={{ padding: 20, fontSize: 13, color: MUTED }}>
          {t('noMatches')}
        </div>
      )}

      {entries.map((entry) => (
        <section key={entry.organization?.id ?? '__none__'} className="app-card app-card--flat">
          <div className="app-card__head">
            <div>
              <h2 className="app-card__title">{entry.organization?.name ?? t('noOrganization')}</h2>
              <p className="app-card__sub">
                {t('summary.agents', {
                  count: entry.agents.length,
                  online: entry.agents.filter((a) => a.isOnline).length,
                })}
              </p>
            </div>
          </div>

          {entry.agents.map((agent) => (
            <AgentBlock
              key={agent.deviceId}
              agent={agent}
              locale={locale}
              formatDateTime={formatDateTime}
              onTestPrint={(printer) => testPrintMutation.mutate(printer.id)}
              testPrintPending={testPrintMutation.isPending}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function AgentBlock({
  agent,
  locale,
  formatDateTime,
  onTestPrint,
  testPrintPending,
}: {
  agent: AdminPrinterOverviewAgent;
  locale: string;
  formatDateTime: (value: string | null | undefined) => string;
  onTestPrint: (printer: Printer) => void;
  testPrintPending: boolean;
}) {
  const t = useTranslations('admin.printers');
  const tPrinters = useTranslations('printers');
  const info = formatAgentInfo(agent.agentInfo);

  return (
    <div style={{ borderTop: '1px solid color-mix(in oklab, var(--ink) 6%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', flexWrap: 'wrap' }}>
        <OnlineDot online={agent.isOnline} />
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{agent.name}</span>
        <span className={agent.isOnline ? 'badge badge--success' : 'badge badge--neutral'}>
          {agent.isOnline ? t('online') : t('offline')}
        </span>
        {agent.status !== 'verified' && <span className="badge badge--warning">{agent.status}</span>}
        <span style={{ fontSize: 12, color: MUTED }}>
          {info || t('noAgentInfo')}
          {agent.lastSeenAt ? ` · ${t('lastSeen', { when: formatTimeAgo(agent.lastSeenAt, locale) })}` : ''}
          {` · ${t('discoveredCount', { count: agent.discoveredCount })}`}
        </span>
      </div>

      {agent.printers.length === 0 ? (
        <p style={{ fontSize: 13, color: MUTED, margin: '0 20px 14px' }}>{t('noPrinters')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.printer')}</th>
                <th>{t('table.type')}</th>
                <th>{t('table.connection')}</th>
                <th>{t('table.online')}</th>
                <th>{t('table.lastSeen')}</th>
                <th className="text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {agent.printers.map((printer) => {
                const connection = formatPrinterConnection(printer.connectionType, printer.connectionConfig);
                const online = agent.isOnline && printer.isOnline;
                return (
                  <tr key={printer.id}>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{printer.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
                        {printer.paperWidth} mm{printer.hasCashDrawer ? ` · ${tPrinters('cashDrawer')}` : ''}
                        {!printer.isActive ? ` · ${tPrinters('inactive')}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={typeBadgeClass[printer.type] ?? 'badge badge--neutral'}>
                        {tPrinters(`types.${printer.type}`)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13 }}>{tPrinters(`connectionTypes.${printer.connectionType}`)}</span>
                      {connection && (
                        <span style={{ display: 'block', fontSize: 12, color: MUTED, fontFamily: 'var(--f-mono)' }}>{connection}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <OnlineDot online={online} />
                        <span style={{ fontSize: 13, color: MUTED }}>{online ? t('online') : t('offline')}</span>
                      </div>
                    </td>
                    <td style={{ color: MUTED, fontSize: 13 }}>{formatDateTime(printer.lastSeenAt)}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={!online || testPrintPending}
                        onClick={() => onTestPrint(printer)}
                      >
                        <Icon name="print" size={14} />
                        {t('actions.testPrint')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
