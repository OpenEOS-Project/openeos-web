'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Icon, type IconName } from '@openeos/ui';

import { ListError, ListLoading } from '@/components/shared/list-states';
import { toast } from '@/components/shared/toast';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useCashbookDay, useCreateCashbookEntry } from '@/hooks/use-dsfinvk';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { businessDateOf, cashbookActionsFor, sortEntriesNewestFirst, summaryRows } from '@/lib/dsfinvk';
import { tseNoticeKind } from '@/lib/tse';
import { useAuthStore } from '@/stores/auth-store';
import type { CashbookEntryType, CashbookEntryView, CashSummary, CreateCashbookEntryData } from '@/types/dsfinvk';

import { CashbookEntryDialog } from './cashbook-entry-dialog';

import '@/styles/cashbook.css';

export const CASHBOOK_ICONS: Record<CashbookEntryType, IconName> = {
  opening_balance: 'cash',
  deposit: 'plus',
  withdrawal: 'minus',
  cash_count: 'list',
};

/**
 * Kassenbuch der ganzen Kasse in der Verwaltung: Geschäftstag wählen,
 * Soll-Bestand gesamt und je Gerät, alle Buchungen des Tages und dieselben
 * vier Buchungen wie an der Kasse (für die ganze Kasse, ohne Gerät).
 * Ohne früheren Kassensturz steht „Wechselgeld aus Vereinskasse“ vorn;
 * sonst ist der Anfangsbestand mit dem zuletzt gezählten Bestand vorbelegt.
 */
export function CashbookContainer() {
  const t = useTranslations('cashbook');
  const { formatCurrency, formatDate } = useLocaleFormat();
  const apiErrorMessage = useApiErrorMessage();
  const organizationId = useAuthStore((state) => state.currentOrganization?.organizationId);
  const today = businessDateOf();
  const [date, setDate] = useState(today);
  const [dialog, setDialog] = useState<CashbookEntryType | null>(null);
  const day = useCashbookDay(organizationId, date);
  const create = useCreateCashbookEntry(organizationId);

  if (!organizationId) return null;
  if (day.isLoading && !day.data) return <ListLoading />;
  if (day.isError && !day.data) return <ListError />;
  const data = day.data;
  if (!data) return null;

  const isToday = date === today;
  const canBook = data.cashAllowed && isToday;

  const book = (body: CreateCashbookEntryData) =>
    create.mutate(body, {
      onSuccess: (result) => {
        setDialog(null);
        const notice = result.tse ? tseNoticeKind(result.tse) : null;
        const bon = result.tse?.bonNumber;
        const base =
          result.entry.type === 'cash_count'
            ? t('bookedCount', { difference: signed(result.entry.amount, formatCurrency) })
            : t('booked', { type: t(`types.${result.entry.type}`), amount: formatCurrency(Math.abs(result.entry.amount)) });
        if (notice === 'failed') toast.error(`${base} · ${t('tseFailed')}`);
        else toast.success(bon ? `${base} · ${t('bon', { bon })}` : base);
      },
      onError: (error) => toast.error(apiErrorMessage(error, t('failed'))),
    });

  const entries = sortEntriesNewestFirst(data.entries);
  // Je Gerät (Schublade); die Zeile ohne Gerät enthält nur Buchungen der
  // Verwaltung (Barzahlungen, Kassenbuch ohne Gerät) und steht am Ende.
  const devices = [...data.devices].sort((a, b) => Number(!a.deviceId) - Number(!b.deviceId));

  return (
    <div className="cb" data-testid="cashbook-admin">
      <div className="app-card cb-toolbar">
        <label className="auth-field cb-toolbar__date">
          <span className="auth-field__label">{t('admin.date')}</span>
          <input
            type="date"
            className="input"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            data-testid="cashbook-date"
          />
        </label>
        {!isToday && (
          <button type="button" className="btn btn--ghost" onClick={() => setDate(today)}>
            {t('admin.today')}
          </button>
        )}
        <span className="cb-toolbar__hint">{t('businessDay', { date: formatDate(data.businessDate) })}</span>
      </div>

      {!data.cashAllowed && (
        <Banner tone="warn" icon={<Icon name="alert" />}>
          {t('cashNotAllowed')}
        </Banner>
      )}

      <div className="cb-grid">
        <section className="app-card cb-total" aria-labelledby="cb-total-title">
          <div className="cb-total__head">
            <span id="cb-total-title" className="stat-card__label">{t('admin.expectedTotal')}</span>
            <b className="cb-total__value" data-testid="cashbook-expected">{formatCurrency(data.total.expected)}</b>
            <LastCount summary={data.total} />
          </div>
          <SummaryList summary={data.total} />
        </section>

        <section className="app-card cb-actions" aria-labelledby="cb-actions-title">
          <h2 id="cb-actions-title" className="cb-h2">{t('admin.actionsTitle')}</h2>
          <p className="cb-muted">{isToday ? t('admin.actionsHint') : t('admin.actionsPast')}</p>
          <div className="cb-actions__grid">
            {cashbookActionsFor(data.openingBalanceSuggestion).map((type) => (
              <button
                key={type}
                type="button"
                className="cb-action"
                onClick={() => setDialog(type)}
                disabled={!canBook}
                data-testid={`cashbook-action-${type}`}
              >
                <Icon name={CASHBOOK_ICONS[type]} />
                <span>
                  <b>{t(`types.${type}`)}</b>
                  <small>{t(`typeHints.${type}`)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {devices.length > 0 && (
        <section className="app-card" aria-labelledby="cb-devices-title">
          <h2 id="cb-devices-title" className="cb-h2">{t('admin.devices')}</h2>
          <ul className="cb-devices">
            {devices.map((d) => (
              <li key={d.deviceId ?? 'none'} className="cb-device">
                <div className="cb-device__head">
                  <b>{d.deviceId ? (d.deviceName ?? t('admin.unknownDevice')) : t('admin.noDevice')}</b>
                  <span className="mono">{formatCurrency(d.summary.expected)}</span>
                </div>
                <SummaryList summary={d.summary} compact />
                <LastCount summary={d.summary} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="app-card" aria-labelledby="cb-entries-title">
        <h2 id="cb-entries-title" className="cb-h2">{t('admin.entries')}</h2>
        {entries.length === 0 ? (
          <p className="tse-empty">{t('entriesEmpty')}</p>
        ) : (
          <>
            <div className="cb-table-wrap">
              <table className="data-table cb-table" data-testid="cashbook-entries">
                <thead>
                  <tr>
                    <th>{t('col.time')}</th>
                    <th>{t('col.device')}</th>
                    <th>{t('col.type')}</th>
                    <th className="text-right">{t('col.amount')}</th>
                    <th className="text-right">{t('col.countedExpected')}</th>
                    <th>{t('col.note')}</th>
                    <th>{t('col.user')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">
                        <EntryTime entry={entry} />
                      </td>
                      <td>{deviceLabel(entry, t)}</td>
                      <td>{t(`types.${entry.type}`)}</td>
                      <td className="text-right mono">
                        <EntryAmount entry={entry} />
                      </td>
                      <td className="text-right mono">
                        {entry.type === 'cash_count' && entry.countedAmount !== null
                          ? `${formatCurrency(entry.countedAmount)} / ${formatCurrency(entry.expectedAmount ?? 0)}`
                          : '–'}
                      </td>
                      <td className="cb-note">{entry.note ?? '–'}</td>
                      <td>{entry.userName ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="cb-cards">
              {entries.map((entry) => (
                <li key={entry.id} className="cb-card">
                  <div className="cb-card__head">
                    <b>{t(`types.${entry.type}`)}</b>
                    <span className="mono cb-card__amount">
                      <EntryAmount entry={entry} />
                    </span>
                  </div>
                  <span className="cb-muted">
                    <EntryTime entry={entry} /> · {deviceLabel(entry, t)}
                    {entry.userName ? ` · ${entry.userName}` : ''}
                  </span>
                  {entry.type === 'cash_count' && entry.countedAmount !== null && (
                    <span className="cb-muted">
                      {t('countedOf', {
                        counted: formatCurrency(entry.countedAmount),
                        expected: formatCurrency(entry.expectedAmount ?? 0),
                      })}
                    </span>
                  )}
                  {entry.note && <span className="cb-note">{entry.note}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <CashbookEntryDialog
        type={dialog}
        expected={data.total.expected}
        suggestion={data.openingBalanceSuggestion}
        pending={create.isPending}
        onClose={() => setDialog(null)}
        onSubmit={book}
      />
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations>;

function deviceLabel(entry: CashbookEntryView, t: Translate): string {
  if (entry.deviceName) return entry.deviceName;
  return entry.deviceId ? t('admin.unknownDevice') : t('admin.register');
}

function signed(value: number, format: (v: number) => string): string {
  return `${value > 0 ? '+' : ''}${format(value)}`;
}

function EntryTime({ entry }: { entry: CashbookEntryView }) {
  const { formatTime } = useLocaleFormat();
  return <>{formatTime(entry.createdAt)}</>;
}

function EntryAmount({ entry }: { entry: CashbookEntryView }) {
  const { formatCurrency } = useLocaleFormat();
  const tone = entry.amount < 0 ? 'minus' : entry.amount > 0 && entry.type !== 'opening_balance' ? 'plus' : 'zero';
  return (
    <span className="cb-amount" data-tone={tone}>
      {signed(entry.amount, formatCurrency)}
    </span>
  );
}

/** Aufschlüsselung des Soll-Bestands (Anfangsbestand … Differenzen). */
export function SummaryList({ summary, compact = false }: { summary: CashSummary; compact?: boolean }) {
  const t = useTranslations('cashbook.summary');
  const { formatCurrency } = useLocaleFormat();
  const rows = summaryRows(summary).filter((row) => !compact || row.value !== 0);
  return (
    <dl className={compact ? 'cb-sums cb-sums--compact' : 'cb-sums'}>
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{t(row.key)}</dt>
          <dd>{signed(row.value, formatCurrency)}</dd>
        </div>
      ))}
    </dl>
  );
}

function LastCount({ summary }: { summary: CashSummary }) {
  const t = useTranslations('cashbook.summary');
  const { formatCurrency, formatTime } = useLocaleFormat();
  if (!summary.lastCount) return null;
  return (
    <span className="cb-muted">
      {t('lastCount', {
        time: formatTime(summary.lastCount.at),
        counted: formatCurrency(summary.lastCount.counted),
        difference: signed(summary.lastCount.difference, formatCurrency),
      })}
    </span>
  );
}
