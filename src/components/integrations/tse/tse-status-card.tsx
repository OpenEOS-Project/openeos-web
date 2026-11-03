'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Banner, Icon, Meter } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { formatBytes, percentOf, shortSerial } from '@/lib/tse';
import type { TseStatus } from '@/types/tse';

/** Produkttypen der Swissbit Cloud-TSE 2 (`validProductTypes`). */
const PRODUCT_NAMES: Record<string, string> = {
  '850004': 'S',
  '850005': 'S+',
  '850007': 'M',
  '850006': 'M+',
  '850008': 'L',
};

export function productName(productType: string | null | undefined): string {
  if (!productType) return '–';
  const name = PRODUCT_NAMES[productType];
  return name ? `${name} (${productType})` : productType;
}

/**
 * Zustand der aktiven Cloud-TSE: Ausfall, Seriennummer (kurz, kopierbar),
 * Kasse (Client-ID), Produkt, Speicher, Signaturen im Monat, Zertifikat,
 * letzter Export und frühere TSEs.
 */
export function TseStatusCard({ status }: { status: TseStatus }) {
  const t = useTranslations('integrations.tse.status');
  const locale = useLocale();
  const { formatDate, formatDateTime, formatNumber } = useLocaleFormat();
  const unit = status.unit!;
  const live = status.live;
  const storage = percentOf(live?.storageUsed, live?.storageCapacity);
  const usage = live?.productTypeUsage;
  const signatures = live?.signaturesThisMonth ?? usage?.signaturesCurrentMonth ?? null;
  const limit = usage?.signatureLimit ?? null;
  const certificateExpiresAt = live?.certificateExpiresAt ?? unit.certificateExpiresAt;
  const previous = status.history.filter((u) => u.id !== unit.id);

  return (
    <div className="app-card" data-testid="tse-status">
      <SettingsSectionHead
        icon="shield-check"
        title={t('title')}
        description={t('description')}
        actions={
          status.outage ? (
            <span className="badge badge--error">{t('badge.error')}</span>
          ) : (
            <span className="badge badge--success">{t('badge.ok')}</span>
          )
        }
      />

      <div className="tse-status">
        {status.outage && (
          <Banner tone="danger" icon={<Icon name="alert" />} title={t('outage.title', { time: formatDateTime(status.outage.since) })}>
            {t('outage.text', { count: status.outage.failedCount })}
            {status.outage.reason ? <span className="tse-mono"> ({status.outage.reason})</span> : null}
          </Banner>
        )}

        <dl className="tse-facts">
          <Fact label={t('serial')}>
            <SerialValue serial={unit.serialNumber} />
          </Fact>
          <Fact label={t('client')}>
            <span className="tse-mono">{unit.clientId}</span>
          </Fact>
          <Fact label={t('product')}>{productName(unit.productType)}</Fact>
          <Fact label={t('activeSince')}>
            {formatDate(unit.activatedAt)}
            <span className="tse-muted"> · {t(`trigger.${unit.trigger}`)}</span>
          </Fact>
          <Fact label={t('certificate')}>
            {certificateExpiresAt ? t('validUntil', { date: formatDate(certificateExpiresAt) }) : '–'}
          </Fact>
          <Fact label={t('lastExport')}>
            {status.exports.lastDownloadedAt ? formatDateTime(status.exports.lastDownloadedAt) : t('noExportYet')}
            {status.exports.pending > 0 && <span className="tse-muted"> · {t('exportsPending', { count: status.exports.pending })}</span>}
          </Fact>
        </dl>

        <div className="tse-meters">
          <Meter
            label={t('storage')}
            value={storage !== null ? storage / 100 : 0}
            hint={
              live
                ? t('storageHint', {
                    used: formatBytes(live.storageUsed, locale),
                    max: formatBytes(live.storageCapacity, locale),
                  })
                : '–'
            }
            tone={storage !== null && storage >= 90 ? 'danger' : storage !== null && storage >= 70 ? 'warn' : undefined}
          />
          <Meter
            label={t('signatures')}
            value={signatures !== null && limit ? Math.min(1, signatures / limit) : 0}
            hint={
              signatures === null
                ? '–'
                : limit
                  ? t('signaturesOf', { count: formatNumber(signatures), limit: formatNumber(limit) })
                  : formatNumber(signatures)
            }
            tone={usage?.slowdownActive ? 'warn' : undefined}
          />
        </div>

        {status.counts && (
          <p className="tse-muted" data-testid="tse-counts">
            {t('counts', {
              signed: status.counts.signed,
              training: status.counts.training,
              failed: status.counts.failed,
            })}
          </p>
        )}

        {status.liveError && <p className="tse-muted">{t('liveError', { code: status.liveError })}</p>}

        {previous.length > 0 && (
          <details className="tse-history">
            <summary>{t('history', { count: previous.length })}</summary>
            <ul>
              {previous.map((u) => (
                <li key={u.id}>
                  <span className="tse-mono" title={u.serialNumber ?? undefined}>
                    {shortSerial(u.serialNumber)}
                  </span>
                  <span>{t(`unitState.${u.state}`)}</span>
                  <span className="tse-muted">
                    {formatDate(u.activatedAt ?? u.createdAt)}
                    {u.deactivatedAt ? ` – ${formatDate(u.deactivatedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tse-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Seriennummer gekürzt anzeigen, vollständig kopieren. */
export function SerialValue({ serial }: { serial: string | null }) {
  const t = useTranslations('integrations.tse.status');
  const [copied, setCopied] = useState(false);
  if (!serial) return <>–</>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serial);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage gesperrt: die volle Nummer steht im Tooltip
    }
  };
  return (
    <span className="tse-serial">
      <span className="tse-mono" title={serial}>
        {shortSerial(serial)}
      </span>
      <button
        type="button"
        className="btn btn--ghost tse-serial__copy"
        onClick={() => void copy()}
        aria-label={t('copySerial')}
        title={t('copySerial')}
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
      {copied && (
        <span className="tse-muted" role="status">
          {t('copied')}
        </span>
      )}
    </span>
  );
}
