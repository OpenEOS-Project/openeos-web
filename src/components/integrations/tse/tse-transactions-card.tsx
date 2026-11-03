'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Segment } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { TseReceiptBlock } from '@/components/tse/tse-receipt-block';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { TSE_TRANSACTIONS_PAGE_SIZE, useTseTransactions } from '@/hooks/use-tse';
import { processDataTotal } from '@/lib/tse';
import type { TseReceiptView, TseTransactionStatus } from '@/types/tse';

type Filter = TseTransactionStatus | 'all';
const FILTERS: Filter[] = ['all', 'signed', 'failed', 'training'];

export const TSE_STATUS_BADGE: Record<TseTransactionStatus, string> = {
  signed: 'badge badge--success',
  training: 'badge badge--info',
  failed: 'badge badge--error',
  pending: 'badge badge--warning',
};

/**
 * Abgesicherte Vorgänge, neueste zuerst: kompakte Tabelle ab Tablet-Breite,
 * darunter zweizeilige Zeilen. Ein Klick klappt die TSE-Angaben samt
 * QR-Code auf (wie auf dem Bon).
 */
export function TseTransactionsCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations('integrations.tse.transactions');
  const tKind = useTranslations('tse.kind');
  const tStatus = useTranslations('tse.status');
  const { formatDateTime, formatCurrency } = useLocaleFormat();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const query = useTseTransactions(organizationId, filter, page);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / TSE_TRANSACTIONS_PAGE_SIZE));

  const amount = (view: TseReceiptView) => {
    const value = processDataTotal(view.processType, view.processData);
    return value === null ? '–' : formatCurrency(value);
  };
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));

  return (
    <div className="app-card" data-testid="tse-transactions">
      <SettingsSectionHead icon="receipt-text" title={t('title')} description={t('description')} />

      <div className="tse-tx__toolbar">
        <Segment<Filter>
          aria-label={t('filterLabel')}
          options={FILTERS.map((id) => ({ id, label: t(`filter.${id}`) }))}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(0);
            setOpen(null);
          }}
        />
        <span className="tse-muted">{t('count', { count: total })}</span>
      </div>

      {query.isError ? (
        <p className="tse-empty">{t('loadFailed')}</p>
      ) : items.length === 0 ? (
        <p className="tse-empty">{query.isLoading ? t('loading') : t('empty')}</p>
      ) : (
        <>
          <div className="tse-tx__table-wrap">
            <table className="data-table tse-tx__table">
              <thead>
                <tr>
                  <th>{t('col.time')}</th>
                  <th>{t('col.kind')}</th>
                  <th>{t('col.status')}</th>
                  <th className="text-right">{t('col.number')}</th>
                  <th className="text-right">{t('col.counter')}</th>
                  <th className="text-right">{t('col.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((view) => (
                  <Fragment key={view.id}>
                    <tr
                      className={open === view.id ? 'tse-tx__row is-open' : 'tse-tx__row'}
                      onClick={() => toggle(view.id)}
                      aria-expanded={open === view.id}
                    >
                      <td>
                        <button type="button" className="tse-tx__link" onClick={(e) => { e.stopPropagation(); toggle(view.id); }}>
                          {formatDateTime(view.createdAt)}
                        </button>
                      </td>
                      <td>{tKind(view.kind)}</td>
                      <td>
                        <span className={TSE_STATUS_BADGE[view.status]}>{tStatus(view.status)}</span>
                        {view.errorCode && <span className="tse-mono tse-muted"> {view.errorCode}</span>}
                      </td>
                      <td className="text-right mono">{view.transactionNumber ?? '–'}</td>
                      <td className="text-right mono">{view.signatureCounter ?? '–'}</td>
                      <td className="text-right mono">{amount(view)}</td>
                    </tr>
                    {open === view.id && (
                      <tr className="tse-tx__detail">
                        <td colSpan={6}>
                          <TransactionDetail view={view} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="tse-tx__rows">
            {items.map((view) => (
              <li key={view.id} className="tse-tx-row">
                <button
                  type="button"
                  className="tse-tx-row__main"
                  onClick={() => toggle(view.id)}
                  aria-expanded={open === view.id}
                >
                  <span className="tse-tx-row__head">
                    <b>{tKind(view.kind)}</b>
                    <span className={TSE_STATUS_BADGE[view.status]}>{tStatus(view.status)}</span>
                    <span className="tse-tx-row__amount mono">{amount(view)}</span>
                  </span>
                  <span className="tse-tx-row__sub tse-muted">
                    {formatDateTime(view.createdAt)}
                    {view.transactionNumber !== null ? ` · ${t('shortNumber', { number: view.transactionNumber })}` : ''}
                    {view.signatureCounter !== null ? ` · ${t('shortCounter', { counter: view.signatureCounter })}` : ''}
                    {view.errorCode ? ` · ${view.errorCode}` : ''}
                  </span>
                </button>
                {open === view.id && <TransactionDetail view={view} />}
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="tse-pager">
              <button type="button" className="btn btn--ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </button>
              <span className="tse-muted">{t('page', { page: page + 1, pages })}</span>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TransactionDetail({ view }: { view: TseReceiptView }) {
  const t = useTranslations('integrations.tse.transactions');
  return (
    <div className="tse-tx__detail-body">
      <TseReceiptBlock view={view} variant="panel" qrSize={148} />
      <dl className="tse-tx__process">
        <dt>{t('processType')}</dt>
        <dd className="tse-mono">{view.processType}</dd>
        <dt>{t('processData')}</dt>
        <dd className="tse-mono">{view.processData || '–'}</dd>
        {view.terminal && (
          <>
            <dt>{t('terminal')}</dt>
            <dd className="tse-mono">{view.terminal}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
