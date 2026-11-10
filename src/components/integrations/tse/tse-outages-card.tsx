'use client';

import { useTranslations } from 'next-intl';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useTseOutages } from '@/hooks/use-tse';

/**
 * Ausfallprotokoll (AEAO zu § 146a Nr. 1.14): wann die TSE nicht signiert
 * hat, warum und wie viele Vorgänge den Vermerk „TSE nicht erreichbar – Beleg ohne Signatur“ tragen.
 */
export function TseOutagesCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations('integrations.tse.outages');
  const { formatDateTime } = useLocaleFormat();
  const outages = useTseOutages(organizationId);
  const items = outages.data ?? [];

  return (
    <div className="app-card" data-testid="tse-outages">
      <SettingsSectionHead icon="activity" title={t('title')} description={t('description')} />
      {items.length === 0 ? (
        <p className="tse-empty">{outages.isLoading ? t('loading') : t('empty')}</p>
      ) : (
        <ul className="tse-outages">
          {items.map((outage) => (
            <li key={outage.id} className={outage.endedAt ? 'tse-outage' : 'tse-outage is-open'}>
              <span className="tse-outage__head">
                <b>
                  {formatDateTime(outage.startedAt)}
                  {' – '}
                  {outage.endedAt ? formatDateTime(outage.endedAt) : t('ongoing')}
                </b>
                <span className={outage.endedAt ? 'badge badge--neutral' : 'badge badge--error'}>
                  {outage.endedAt ? t('closed') : t('open')}
                </span>
              </span>
              <span className="tse-muted">
                {t('failedCount', { count: outage.failedCount })}
                {outage.reason ? ` · ${outage.reason}` : ''}
              </span>
              {outage.lastErrorMessage && <span className="tse-mono tse-muted tse-outage__msg">{outage.lastErrorMessage}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
