'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useRequestTseExport, useTseExports } from '@/hooks/use-tse';
import { tseApi } from '@/lib/api-client';
import { formatBytes } from '@/lib/tse';
import type { TseExport, TseExportStatus } from '@/types/tse';

const STATUS_BADGE: Record<TseExportStatus, string> = {
  downloaded: 'badge badge--success',
  pending: 'badge badge--warning',
  failed: 'badge badge--error',
};

/** Nach „Export jetzt starten“ fragt die Liste so lange nach (Swissbit braucht bis zu einigen Minuten). */
const POLL_AFTER_REQUEST_MS = 3 * 60_000;

/**
 * TSE-Exporte (TAR nach TR-03153) im Archiv von OpenEOS: Zeitraum, Größe,
 * Prüfsumme, Download. Nächtlich automatisch; „Export jetzt starten“ für
 * eine Kassen-Nachschau.
 */
export function TseExportsCard({ organizationId, active }: { organizationId: string; active: boolean }) {
  const t = useTranslations('integrations.tse.exports');
  const locale = useLocale();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const [pollUntil, setPollUntil] = useState<number | null>(null);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const exports = useTseExports(organizationId, true, pollUntil !== null);
  const request = useRequestTseExport(organizationId);
  const items = exports.data ?? [];

  // Fertig, sobald ein nach dem Start angelegter Export nicht mehr läuft.
  useEffect(() => {
    if (requestedAt === null) return;
    const finished = items.some(
      (item) => item.status !== 'pending' && new Date(item.createdAt).getTime() >= requestedAt - 5_000,
    );
    if (finished) {
      setPollUntil(null);
      setRequestedAt(null);
    }
  }, [items, requestedAt]);

  useEffect(() => {
    if (pollUntil === null) return;
    const timer = window.setTimeout(() => {
      setPollUntil(null);
      setRequestedAt(null);
    }, Math.max(0, pollUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pollUntil]);

  const start = () =>
    request.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('started'));
        setRequestedAt(Date.now());
        setPollUntil(Date.now() + POLL_AFTER_REQUEST_MS);
      },
      onError: (error) => toast.error(apiErrorMessage(error, t('startFailed'))),
    });

  const download = async (item: TseExport) => {
    setDownloading(item.id);
    try {
      const { blob } = await tseApi.downloadExport(organizationId, item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename ?? `tse-export-${item.id}.tar`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('downloadFailed')));
    } finally {
      setDownloading(null);
    }
  };

  const period = (item: TseExport) =>
    item.periodFrom || item.periodTo
      ? `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo)}`
      : formatDateTime(item.createdAt);

  return (
    <div className="app-card" data-testid="tse-exports">
      <SettingsSectionHead
        icon="archive"
        title={t('title')}
        description={t('description')}
        actions={
          active ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={start}
              disabled={request.isPending}
              data-testid="tse-export-start"
            >
              <Icon name="refresh" />
              {request.isPending ? t('starting') : t('start')}
            </button>
          ) : undefined
        }
      />

      <p className="tse-text">{t('nachschau')}</p>

      {pollUntil !== null && (
        <p className="tse-progress tse-progress--inline" role="status">
          <span className="tse-spinner" aria-hidden="true" />
          {t('running')}
        </p>
      )}

      {items.length === 0 ? (
        <p className="tse-empty">{exports.isLoading ? t('loading') : t('empty')}</p>
      ) : (
        <ul className="tse-exports">
          {items.map((item) => (
            <li key={item.id} className="tse-export">
              <div className="tse-export__main">
                <span className="tse-export__head">
                  <b>{period(item)}</b>
                  <span className={STATUS_BADGE[item.status]}>{t(`status.${item.status}`)}</span>
                </span>
                <span className="tse-muted">
                  {t(`trigger.${item.trigger}`)}
                  {item.sizeBytes !== null ? ` · ${formatBytes(item.sizeBytes, locale)}` : ''}
                  {item.downloadedAt ? ` · ${t('archivedAt', { date: formatDateTime(item.downloadedAt) })}` : ''}
                  {item.errorCode ? ` · ${item.errorCode}` : ''}
                </span>
                {item.sha256 && (
                  <span className="tse-mono tse-muted tse-export__sha" title={item.sha256}>
                    SHA-256 {item.sha256.slice(0, 16)}…
                  </span>
                )}
              </div>
              {item.downloadable && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void download(item)}
                  disabled={downloading === item.id}
                  aria-label={t('downloadLabel', { period: period(item) })}
                  data-testid="tse-export-download"
                >
                  <Icon name="download" />
                  <span className="tse-export__dl-text">{downloading === item.id ? t('downloading') : t('download')}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
