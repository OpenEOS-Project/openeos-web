'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banner, Icon, Segment } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCreateClosing, useDsfinvkClosings } from '@/hooks/use-dsfinvk';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useUpdateCurrentOrganizationSettings } from '@/hooks/use-organizations';
import { useRequestTseExport } from '@/hooks/use-tse';
import { dsfinvkApi, tseApi } from '@/lib/api-client';
import {
  businessDateOf,
  centsToEuros,
  fallbackFilename,
  isValidRange,
  kassenNachschauDocsUrl,
  rangeIncludesToday,
  salesGrossCents,
  saveBlob,
  tipRecipientOf,
} from '@/lib/dsfinvk';
import { useAuthStore } from '@/stores/auth-store';
import { ApiException } from '@/types/api';
import type { CashPointClosingView } from '@/types/dsfinvk';

const reasonOf = (error: unknown) => (error instanceof ApiException ? (error.reason ?? error.code) : null);

/**
 * Kassen-Nachschau (§ 146b AO): was der Prüferin übergeben wird —
 * DSFinV-K-Export (ZIP), TSE-Export (TAR) und Verfahrensdokumentation —,
 * Export für einen Zeitraum aus Geschäftstagen (6–6 Uhr) und der
 * Trinkgeld-Empfänger für den Export.
 */
export function TseNachschauCard({ organizationId, active }: { organizationId: string; active: boolean }) {
  const t = useTranslations('integrations.tse.nachschau');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const today = businessDateOf();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<'dsfinvk' | 'tse' | null>(null);
  const [tseMissing, setTseMissing] = useState(false);
  const closings = useDsfinvkClosings(organizationId, { limit: 20 });
  const createClosing = useCreateClosing(organizationId);
  const requestExport = useRequestTseExport(organizationId);
  const rangeOk = isValidRange(from, to);

  const exportDsfinvk = async () => {
    if (!rangeOk) return;
    setBusy('dsfinvk');
    try {
      // Der laufende Tag steht erst nach einem Abschluss im Export.
      if (rangeIncludesToday(from, to)) {
        const fresh = await closings.refetch();
        if ((fresh.data?.open.transactions ?? 0) > 0) {
          try {
            const created = await createClosing.mutateAsync();
            if (created.length > 0) {
              toast.success(t('closedBeforeExport', { numbers: created.map((c) => c.zNr).join(', ') }));
            }
          } catch (error) {
            if (reasonOf(error) !== 'DSFINVK_NOTHING_TO_CLOSE') throw error;
          }
        }
      }
      const file = await dsfinvkApi.export(organizationId, { from, to });
      saveBlob(file.blob, file.filename ?? fallbackFilename('dsfinvk', from, to));
      toast.success(t('exported'));
    } catch (error) {
      toast.error(apiErrorMessage(error, t('exportFailed')));
    } finally {
      setBusy(null);
    }
  };

  const exportTse = async () => {
    if (!rangeOk) return;
    setBusy('tse');
    setTseMissing(false);
    try {
      const file = await tseApi.downloadBundle(organizationId, { from, to });
      saveBlob(file.blob, file.filename ?? fallbackFilename('tse', from, to));
      toast.success(t('tseExported'));
    } catch (error) {
      if (reasonOf(error) === 'TSE_EXPORT_NOT_FOUND' || (error instanceof ApiException && error.status === 404)) {
        setTseMissing(true);
      } else {
        toast.error(apiErrorMessage(error, t('exportFailed')));
      }
    } finally {
      setBusy(null);
    }
  };

  const startTseExport = () =>
    requestExport.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('tseStarted'));
        setTseMissing(false);
      },
      onError: (error) => toast.error(apiErrorMessage(error, t('tseStartFailed'))),
    });

  return (
    <div className="app-card" data-testid="tse-nachschau">
      <SettingsSectionHead icon="file-search" title={t('title')} description={t('description')} />

      <div className="nachschau">
        <div className="nachschau__intro">
          <p className="tse-text">{t('intro')}</p>
          <ol className="nachschau__docs">
            <li>
              <b>{t('items.dsfinvk')}</b> <span className="tse-muted">{t('items.dsfinvkHint')}</span>
            </li>
            <li>
              <b>{t('items.tse')}</b> <span className="tse-muted">{t('items.tseHint')}</span>
            </li>
            <li>
              <b>{t('items.procedure')}</b> <span className="tse-muted">{t('items.procedureHint')}</span>
            </li>
          </ol>
          <a className="notice-link" href={kassenNachschauDocsUrl(locale)} target="_blank" rel="noopener noreferrer">
            {t('docsLink')}
          </a>
        </div>

        <div className="nachschau__range" role="group" aria-label={t('range')}>
          <label className="auth-field">
            <span className="auth-field__label">{t('from')}</span>
            <input
              type="date"
              className="input"
              value={from}
              max={today}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value > to) setTo(e.target.value);
              }}
              data-testid="nachschau-from"
            />
          </label>
          <label className="auth-field">
            <span className="auth-field__label">{t('to')}</span>
            <input
              type="date"
              className="input"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              data-testid="nachschau-to"
            />
          </label>
          <button
            type="button"
            className="btn btn--ghost nachschau__today"
            onClick={() => {
              setFrom(today);
              setTo(today);
            }}
            disabled={from === today && to === today}
          >
            {t('today')}
          </button>
        </div>
        <p className="tse-muted" style={{ margin: 0 }}>{t('rangeHint')}</p>

        <div className="nachschau__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void exportDsfinvk()}
            disabled={!rangeOk || busy !== null}
            data-testid="nachschau-dsfinvk"
          >
            <Icon name="download" />
            {busy === 'dsfinvk' ? t('exporting') : t('exportDsfinvk')}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void exportTse()}
            disabled={!rangeOk || busy !== null}
            data-testid="nachschau-tse"
          >
            <Icon name="download" />
            {busy === 'tse' ? t('exporting') : t('exportTse')}
          </button>
        </div>

        {tseMissing && (
          <Banner tone="warn" icon={<Icon name="info" />} title={t('tseMissingTitle')}>
            <span>{t('tseMissingText')}</span>
            {active && (
              <span className="nachschau__banner-action">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={startTseExport}
                  disabled={requestExport.isPending}
                  data-testid="nachschau-tse-start"
                >
                  <Icon name="refresh" />
                  {requestExport.isPending ? t('tseStarting') : t('tseStart')}
                </button>
              </span>
            )}
          </Banner>
        )}

        <TipRecipientSetting />
      </div>
    </div>
  );
}

/** Trinkgeld-Empfänger im Export: Verein (TrinkgeldAG) oder Helfer (TrinkgeldAN). */
function TipRecipientSetting() {
  const t = useTranslations('integrations.tse.nachschau.tip');
  const apiErrorMessage = useApiErrorMessage();
  const settings = useAuthStore((state) => state.currentOrganization?.organization?.settings);
  const save = useUpdateCurrentOrganizationSettings();
  const value = tipRecipientOf(settings);

  const change = (next: 'employer' | 'employee') => {
    if (next === value) return;
    save.mutate(
      { dsfinvk: { ...settings?.dsfinvk, tipRecipient: next } },
      {
        onSuccess: () => toast.success(t('saved')),
        onError: (error) => toast.error(apiErrorMessage(error, t('saveFailed'))),
      },
    );
  };

  return (
    <div className="nachschau__tip" data-testid="nachschau-tip">
      <div>
        <b>{t('title')}</b>
        <p className="tse-muted" style={{ margin: 0 }}>{t('hint')}</p>
      </div>
      <Segment<'employer' | 'employee'>
        aria-label={t('title')}
        value={value}
        onChange={change}
        options={[
          { id: 'employer', label: t('employer') },
          { id: 'employee', label: t('employee') },
        ]}
      />
    </div>
  );
}

/**
 * Kassenabschlüsse (Z-Bons): Z-Nr., Geschäftstag, Umsatz, Bar-Anteil,
 * Anzahl der Vorgänge, Download des DSFinV-K-Exports je Abschluss und
 * „Kassenabschluss jetzt erstellen“ für die offenen Vorgänge.
 */
export function TseClosingsCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations('integrations.tse.closings');
  const { formatCurrency, formatDate, formatDateTime } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const [limit, setLimit] = useState(20);
  const closings = useDsfinvkClosings(organizationId, { limit });
  const create = useCreateClosing(organizationId);
  const [downloading, setDownloading] = useState<string | null>(null);
  const items = closings.data?.items ?? [];
  const open = closings.data?.open;

  const closeNow = () =>
    create.mutate(undefined, {
      onSuccess: (created) =>
        toast.success(
          created.length === 1
            ? t('created', { zNr: created[0].zNr })
            : t('createdMany', { numbers: created.map((c) => c.zNr).join(', ') }),
        ),
      onError: (error) => toast.error(apiErrorMessage(error, t('createFailed'))),
    });

  const download = async (closing: CashPointClosingView) => {
    setDownloading(closing.id);
    try {
      const file = await dsfinvkApi.downloadClosing(organizationId, closing.id);
      saveBlob(file.blob, file.filename ?? `dsfinvk_Z${closing.zNr}_${closing.businessDate}.zip`);
    } catch (error) {
      toast.error(apiErrorMessage(error, t('downloadFailed')));
    } finally {
      setDownloading(null);
    }
  };

  const badges = (closing: CashPointClosingView) => (
    <>
      {closing.totals.counts.failed > 0 && (
        <span className="badge badge--error">{t('failed', { count: closing.totals.counts.failed })}</span>
      )}
      {closing.totals.counts.training > 0 && (
        <span className="badge badge--warning">{t('training', { count: closing.totals.counts.training })}</span>
      )}
    </>
  );

  const downloadButton = (closing: CashPointClosingView) => (
    <button
      type="button"
      className="btn btn--ghost"
      onClick={() => void download(closing)}
      disabled={downloading === closing.id}
      aria-label={t('downloadLabel', { zNr: closing.zNr })}
      data-testid="closing-download"
    >
      <Icon name="download" />
      <span className="tse-export__dl-text">{downloading === closing.id ? t('downloading') : t('download')}</span>
    </button>
  );

  return (
    <div className="app-card" data-testid="tse-closings">
      <SettingsSectionHead
        icon="receipt-text"
        title={t('title')}
        description={t('description')}
        actions={
          <button
            type="button"
            className="btn btn--secondary"
            onClick={closeNow}
            disabled={create.isPending || !open || open.transactions === 0}
            data-testid="closing-create"
          >
            <Icon name="check" />
            {create.isPending ? t('creating') : t('create')}
          </button>
        }
      />

      {open && (
        <p className="closings__open" data-testid="closings-open">
          <Icon name="clock" size={16} />
          {open.transactions > 0 && open.since
            ? t('openSince', { since: formatDateTime(open.since), count: open.transactions })
            : t('nothingOpen')}
        </p>
      )}

      {closings.isError ? (
        <p className="tse-empty">{apiErrorMessage(closings.error, t('loadFailed'))}</p>
      ) : items.length === 0 ? (
        <p className="tse-empty">{closings.isLoading ? t('loading') : t('empty')}</p>
      ) : (
        <>
          <div className="tse-tx__table-wrap">
            <table className="data-table tse-tx__table closings__table">
              <thead>
                <tr>
                  <th>{t('col.zNr')}</th>
                  <th>{t('col.businessDate')}</th>
                  <th className="text-right">{t('col.gross')}</th>
                  <th className="text-right" title={t('col.cashHint')}>{t('col.cash')}</th>
                  <th>{t('col.transactions')}</th>
                  <th className="text-right">
                    <span className="oe-sr-only">{t('col.download')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((closing) => (
                  <tr key={closing.id}>
                    <td className="mono">Z{closing.zNr}</td>
                    <td>
                      {formatDate(closing.businessDate)}
                      {closing.trigger === 'manual' && <span className="tse-muted"> · {t('manual')}</span>}
                    </td>
                    <td className="text-right mono">{formatCurrency(centsToEuros(salesGrossCents(closing.totals)))}</td>
                    <td className="text-right mono">{formatCurrency(centsToEuros(closing.totals.cashCents))}</td>
                    <td>
                      <span className="closings__count">
                        {closing.transactionCount}
                        {badges(closing)}
                      </span>
                    </td>
                    <td className="text-right">{downloadButton(closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="tse-tx__rows">
            {items.map((closing) => (
              <li key={closing.id} className="tse-tx-row closings__card">
                <div className="closings__card-main">
                  <span className="tse-tx-row__head">
                    <b>Z{closing.zNr}</b>
                    <span>{formatDate(closing.businessDate)}</span>
                    <span className="tse-tx-row__amount mono">{formatCurrency(centsToEuros(salesGrossCents(closing.totals)))}</span>
                  </span>
                  <span className="tse-muted closings__count">
                    {t('cardLine', {
                      cash: formatCurrency(centsToEuros(closing.totals.cashCents)),
                      count: closing.transactionCount,
                    })}
                    {badges(closing)}
                  </span>
                </div>
                {downloadButton(closing)}
              </li>
            ))}
          </ul>

          {items.length >= limit && (
            <div className="tse-pager">
              <button type="button" className="btn btn--ghost" onClick={() => setLimit(limit + 20)}>
                {t('more')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
