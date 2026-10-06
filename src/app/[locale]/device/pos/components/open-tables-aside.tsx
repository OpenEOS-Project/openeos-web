'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { EmptyState, Icon, IconBox, Spinner } from '@openeos/ui';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { PosTableContext } from '@/types/table';
import type { OpenTableEntry } from '../utils/tables';

interface OpenTablesAsideProps {
  entries: OpenTableEntry[];
  onOpen: (context: PosTableContext) => void;
  isLoading?: boolean;
  /** Ohne Live-Verbindung: Stand des Tischstatus (Zeitstempel in ms). */
  staleSince?: number | null;
}

/** Minuten seit einem Zeitpunkt; tickt alle 30 s. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Seitenleiste „Offene Tische“ der Startansicht: Tische mit offenen
 * Bestellungen oder wartender Bedienung (Server) und lokal geparkte
 * Warenkörbe dieses Geräts. Antippen öffnet den Tisch.
 */
export function OpenTablesAside({ entries, onOpen, isLoading, staleSince }: OpenTablesAsideProps) {
  const t = useTranslations('pos.tables');
  const tFloor = useTranslations('pos.floor');
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const now = useNow();

  const title = (context: PosTableContext) =>
    context.kind === 'table'
      ? t('rowTable', { label: context.label })
      : context.kind === 'togo'
        ? t('togo')
        : t('counter');

  const meta = (entry: OpenTableEntry) => {
    const parts: string[] = [];
    if (entry.state === 'wait') {
      // Grund zuerst: bei schmaler Leiste wird hinten gekürzt.
      if (entry.waitReason === 'guest') parts.push(tFloor('reasonGuest'));
      else if (entry.waitReason === 'ready') parts.push(tFloor('reasonReady'));
      const since = entry.waitingSince ? Date.parse(entry.waitingSince) : NaN;
      const minutes = Number.isFinite(since) ? Math.max(0, Math.floor((now - since) / 60_000)) : null;
      parts.push(
        minutes === null
          ? t('hintWait')
          : minutes < 60
            ? t('metaWaiting', { minutes })
            : minutes < 24 * 60
              ? t('metaWaitingHours', { hours: Math.floor(minutes / 60) })
              : t('metaWaitingLong'),
      );
    }
    if (entry.orderCount > 0) parts.push(t('metaOrders', { count: entry.orderCount }));
    if (entry.localItems > 0) parts.push(t('metaLocal', { count: entry.localItems }));
    return parts.join(' · ');
  };

  const stale = staleSince
    ? t('staleSince', {
        time: new Date(staleSince).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      })
    : null;

  return (
    <aside className="pos-open" aria-labelledby="pos-open-title">
      <div className="pos-open__hd">
        <IconBox icon="cart" tone="accent" />
        <div>
          <b id="pos-open-title">{t('openTitle')}</b>
          <span>
            {t('openCount', { count: entries.length })}
            {stale && ` · ${stale}`}
          </span>
        </div>
      </div>
      {isLoading && entries.length === 0 ? (
        <div className="pos-center">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<Icon name="table" />} title={t('openEmpty')} description={t('openEmptyHint')} />
      ) : (
        <ul className="pos-open__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="pos-openrow"
                aria-label={[title(entry.context), meta(entry), formatPrice(entry.amount)].filter(Boolean).join(', ')}
                onClick={() => onOpen(entry.context)}
              >
                <span className={`oe-tablechip oe-tablechip--${entry.state} pos-openrow__chip`} aria-hidden>
                  {entry.context.kind === 'table' ? (
                    entry.context.label
                  ) : (
                    <Icon name={entry.context.kind === 'togo' ? 'send' : 'beer'} />
                  )}
                </span>
                <span className="pos-openrow__main">
                  <b>{title(entry.context)}</b>
                  <span>{meta(entry)}</span>
                </span>
                <span className="pos-openrow__sum">{formatPrice(entry.amount)}</span>
                <Icon name="chevron-right" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
