'use client';

import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';

import { Banner, Icon } from '@openeos/ui';
import { useQuery } from '@tanstack/react-query';

import { ListEmpty, ListError, ListLoading } from '@/components/shared/list-states';

import { useIntlLocale, useLocaleFormat } from '@/hooks/use-locale-format';

import { adminApi } from '@/lib/api-client';
import {
  currentPostponement,
  isMonthlyDeactivation,
  overdueUnits,
  quotedEventNames,
  shortSerial,
  tseKeepLines,
  tseMonthLabel,
} from '@/lib/tse';

import type { AdminTseUnit, TseHealthIssue } from '@/types/tse';

const MUTED = 'color-mix(in oklab, var(--ink) 55%, transparent)';

const stateBadge: Record<string, string> = {
  creating: 'badge badge--info',
  active: 'badge badge--success',
  failed: 'badge badge--error',
  deactivated: 'badge badge--neutral',
};

/**
 * Betreiber-Sicht auf alle Cloud-TSEs: Zustand, Auslöser, geplante
 * Abmeldung zum Monatsende (mit Verschiebungen und Kostenhinweis),
 * berechnete Monate. Roter Hinweis, wenn eine Abmeldung um 22:00 noch
 * aussteht oder die tägliche Prüfung etwas findet.
 */
export function AdminTseContainer() {
  const t = useTranslations('admin.tse');
  const { formatDate, formatDateTime } = useLocaleFormat();
  const [search, setSearch] = useState('');

  const unitsQuery = useQuery({
    queryKey: ['admin', 'tse', 'units'],
    queryFn: async () => (await adminApi.listTseUnits()).data,
    refetchInterval: 60_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['admin', 'tse', 'alerts'],
    queryFn: async () => (await adminApi.tseAlerts()).data,
    refetchInterval: 60_000,
  });

  const units = useMemo(() => {
    const all = unitsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (unit) =>
        (unit.organization?.name ?? '').toLowerCase().includes(needle) ||
        (unit.serialNumber ?? '').toLowerCase().includes(needle)
    );
  }, [unitsQuery.data, search]);

  if (unitsQuery.isLoading) return <ListLoading />;
  if (unitsQuery.isError) return <ListError onRetry={() => unitsQuery.refetch()} />;

  const all = unitsQuery.data ?? [];
  const overdue = overdueUnits(all);
  const issues = (alertsQuery.data?.issues ?? []).filter(
    (issue) => issue.kind !== 'deactivation_overdue'
  );
  const active = all.filter((u) => u.state === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {overdue.length > 0 && (
        <div data-testid="admin-tse-overdue">
          <Banner
            tone="danger"
            icon={<Icon name="alert" />}
            title={t('overdue.title', { count: overdue.length })}
          >
            {t('overdue.text')}
            {/* Banner setzt den Inhalt in ein <p>: Zeilen als Spans, keine Liste. */}
            {overdue.map((unit) => (
              <span key={unit.id} style={{ display: 'block', marginTop: 6 }}>
                {unit.organization?.name ?? '–'} ·{' '}
                <span className="tse-mono">{shortSerial(unit.serialNumber)}</span> ·{' '}
                {t('overdue.item', {
                  planned: formatDateTime(unit.plannedDeactivationAt),
                  attempts: unit.deactivationAttempts,
                })}
                {unit.lastError ? ` · ${unit.lastError.code}` : ''}
              </span>
            ))}
          </Banner>
        </div>
      )}

      {issues.length > 0 && (
        <div data-testid="admin-tse-health">
          <Banner
            tone="danger"
            icon={<Icon name="alert" />}
            title={t('health.title', { count: issues.length })}
          >
            {issues.map((issue: TseHealthIssue) => (
              <span key={`${issue.unitId}-${issue.kind}`} style={{ display: 'block' }}>
                {issue.organizationName ?? issue.organizationId} ·{' '}
                <span className="tse-mono">{shortSerial(issue.serialNumber)}</span> ·{' '}
                {t(`health.kind.${issue.kind}`)}
              </span>
            ))}
          </Banner>
        </div>
      )}

      <div className="app-card app-card--flat" style={{ paddingBottom: 0 }}>
        <div className="app-card__head" style={{ borderBottom: 'none', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="app-card__title">{t('summary.title')}</h2>
            <p className="app-card__sub">
              {t('summary.counts', { total: all.length, active })}
              {alertsQuery.data ? ` · ${t(`lifecycle.${alertsQuery.data.lifecycle}`)}` : ''}
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

      {all.length === 0 ? (
        <ListEmpty
          title={t('empty.title')}
          description={t('empty.description')}
          icon={<Icon name="shield" size={28} />}
        />
      ) : (
        <div className="app-card app-card--flat">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" data-testid="admin-tse-table">
              <thead>
                <tr>
                  <th>{t('table.organization')}</th>
                  <th>{t('table.tse')}</th>
                  <th>{t('table.active')}</th>
                  <th>{t('table.planned')}</th>
                  <th>{t('table.billed')}</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitRow({
  unit,
  formatDate,
  formatDateTime,
}: {
  unit: AdminTseUnit;
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
}) {
  const t = useTranslations('admin.tse');
  const tStatus = useTranslations('integrations.tse.status');
  const locale = useIntlLocale();
  const postponement = currentPostponement(unit);
  const postponedCount = unit.postponements?.length ?? 0;
  const keepLines = tseKeepLines(unit.lifecycleOutlook);
  const expected = unit.lifecycleOutlook?.expectedDeactivationAt ?? null;
  const expectedLater =
    !!expected &&
    !!unit.plannedDeactivationAt &&
    new Date(expected).getTime() !== new Date(unit.plannedDeactivationAt).getTime();

  return (
    <tr
      data-testid="admin-tse-row"
      style={
        unit.deactivationOverdue
          ? { background: 'color-mix(in oklab, var(--danger) 7%, transparent)' }
          : undefined
      }
    >
      <td>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
          {unit.organization?.name ?? '–'}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
          {tStatus(`trigger.${unit.trigger}`)}
        </span>
      </td>
      <td>
        <span
          className="tse-mono"
          style={{ whiteSpace: 'nowrap' }}
          title={unit.serialNumber ?? undefined}
        >
          {shortSerial(unit.serialNumber)}
        </span>
        <span style={{ display: 'block' }}>
          <span className={stateBadge[unit.state] ?? 'badge badge--neutral'}>
            {tStatus(`unitState.${unit.state}`)}
          </span>
        </span>
      </td>
      <td style={{ fontSize: 13 }}>
        {formatDate(unit.activatedAt ?? unit.createdAt)}
        {unit.deactivatedAt && (
          <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
            {t('deactivatedOn', { date: formatDateTime(unit.deactivatedAt) })}
            {unit.deactivationReason
              ? ` · ${isMonthlyDeactivation(unit.deactivationReason) ? t('reasonMonthly') : unit.deactivationReason}`
              : ''}
          </span>
        )}
      </td>
      <td style={{ fontSize: 13 }} data-testid="admin-tse-planned">
        {unit.plannedDeactivationAt ? formatDateTime(unit.plannedDeactivationAt) : '–'}
        {unit.deactivationOverdue && (
          <span className="badge badge--error" style={{ marginLeft: 6 }}>
            {t('overdueBadge')}
          </span>
        )}
        {unit.deactivationAttempts > 0 && unit.state === 'active' && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--danger)' }}>
            {t('attempts', { count: unit.deactivationAttempts })}
            {unit.lastError ? ` · ${unit.lastError.code}` : ''}
          </span>
        )}
        {postponement && (
          <span
            style={{ display: 'block', fontSize: 12, color: MUTED }}
            data-testid="admin-tse-postponed"
          >
            {t('postponed', {
              event: postponement.events.map((e) => `„${e.name}“`).join(', '),
              month: postponement.extraMonth,
            })}
          </span>
        )}
        {expectedLater && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink)' }} data-testid="admin-tse-expected">
            {t('expected', { date: formatDateTime(expected) })}
          </span>
        )}
        {keepLines.map((line) => (
          <span
            key={line.month}
            style={{ display: 'block', fontSize: 12, color: MUTED }}
            data-testid="admin-tse-kept"
          >
            {t(line.reason === 'paid_event_running' ? 'keptRunning' : 'keptBooked', {
              month: tseMonthLabel(line.month, locale),
              events: quotedEventNames(line.events, locale),
            })}{' '}
            <span className="badge badge--neutral" style={{ fontSize: 11 }}>
              {t(line.decided ? 'keptDecided' : 'keptForecast')}
            </span>
          </span>
        ))}
        {!postponement && postponedCount > 0 && (
          <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
            {t('postponedBefore', { count: postponedCount })}
          </span>
        )}
      </td>
      <td style={{ fontSize: 13 }} title={unit.billedMonths.join(', ')}>
        {t('billedMonths', { count: unit.billedMonths.length })}
        {unit.billedMonths.length > 0 && (
          <span style={{ display: 'block', fontSize: 12, color: MUTED }}>
            {unit.billedMonths[0]}
            {unit.billedMonths.length > 1
              ? ` – ${unit.billedMonths[unit.billedMonths.length - 1]}`
              : ''}
          </span>
        )}
      </td>
    </tr>
  );
}
