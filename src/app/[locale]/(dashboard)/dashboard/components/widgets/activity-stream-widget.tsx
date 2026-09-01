'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useActivityStream } from '@/hooks/use-reports';
import { formatCurrency } from '@/utils/format';
import type { ActivityEntry } from '@/types/report';

interface Props {
  organizationId: string;
}

/**
 * Ereignisstrom des laufenden Betriebs.
 *
 * Aus der Designvorlage übernommen, dort als "Audit-Log" mit
 * TSE-Signaturen. OpenEOS hat keine TSE und kein eigenes Journal — der
 * Strom kommt deshalb aus dem, was tatsächlich protokolliert wird:
 * Bestellungen, Zahlungen, Druckaufträge.
 */
export function ActivityStreamWidget({ organizationId }: Props) {
  const t = useTranslations('dashboard.widgets.activity');
  const locale = useLocale();
  const { data, isLoading } = useActivityStream(organizationId);

  const uhrzeit = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));

  /* Die Rohwerte aus der Datenbank ("apple_pay", "failed") gehören
     nicht auf ein Dashboard. Unbekannte Werte werden durchgereicht —
     t() wuerde bei fehlendem Schluessel sonst werfen, und eine
     Fehlermeldung eines Druckers ist nun einmal kein Schluessel. */
  const beschriftung = (e: ActivityEntry): string => {
    if (e.kind === 'order') return e.message;
    const key = `${e.kind}.${e.message}`;
    return t.has(key) ? t(key) : e.message;
  };

  return (
    <div className="app-card app-card--flat stream-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('label')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <span className="oe-badge oe-badge--outline">
          <span className="oe-dot oe-dot--live" />
          {t('live')}
        </span>
      </div>

      {isLoading ? (
        <div className="widget-state">
          <span className="oe-spinner" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="widget-state">
          <p className="empty-state__sub">{t('empty')}</p>
        </div>
      ) : (
        <div className="oe-stream stream-card__list">
          {data.map((e) => (
            <div className="oe-stream__row" key={e.id}>
              <span className="oe-stream__t">{uhrzeit(e.at)}</span>
              <span
                className={
                  e.tone === 'ok'
                    ? 'oe-stream__tag oe-stream__tag--ok'
                    : e.tone === 'error'
                      ? 'oe-stream__tag oe-stream__tag--err'
                      : 'oe-stream__tag'
                }
              >
                {t(`kind.${e.kind}`)}
              </span>
              <span>
                {beschriftung(e)}
                {e.amount !== null ? ` · ${formatCurrency(e.amount)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
