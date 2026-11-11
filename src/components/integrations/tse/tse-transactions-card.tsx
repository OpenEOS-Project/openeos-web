'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconButton, Segment, type DataColumn } from '@openeos/ui';

import { SettingsSectionHead } from '@/app/[locale]/(dashboard)/settings/components/settings-section-head';
import { AdminPager, AdminTable } from '@/components/shared/admin-table';
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
 * Abgesicherte Vorgänge, neueste zuerst (DataTable: Tabelle ab Tablet-Breite,
 * darunter zweizeilige Einträge). Ein Klick zeigt die TSE-Angaben samt
 * QR-Code (wie auf dem Bon) im Feld unter der Tabelle.
 */
export function TseTransactionsCard({ organizationId }: { organizationId: string }) {
  const t = useTranslations('integrations.tse.transactions');
  const tKind = useTranslations('tse.kind');
  const tStatus = useTranslations('tse.status');
  const tCommon = useTranslations('common');
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
  const selected = open ? items.find((view) => view.id === open) : undefined;

  // Das Feld liegt unter der Tabelle — beim Öffnen in den sichtbaren Bereich holen.
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  const columns: DataColumn<TseReceiptView>[] = [
    {
      id: 'time',
      header: t('col.time'),
      mobile: 'meta',
      className: 'tse-tx-list__time',
      cell: (view) => formatDateTime(view.createdAt),
    },
    {
      id: 'kind',
      header: t('col.kind'),
      mobile: 'title',
      cell: (view) => tKind(view.kind),
    },
    {
      id: 'status',
      header: t('col.status'),
      mobile: 'subtitle',
      cell: (view) => (
        <>
          <span className={TSE_STATUS_BADGE[view.status]}>{tStatus(view.status)}</span>
          {view.errorCode && <span className="tse-mono tse-muted"> {view.errorCode}</span>}
        </>
      ),
    },
    {
      id: 'number',
      header: t('col.number'),
      num: true,
      cell: (view) => view.transactionNumber ?? '–',
    },
    {
      id: 'counter',
      header: t('col.counter'),
      num: true,
      priority: 2,
      cell: (view) => view.signatureCounter ?? '–',
    },
    {
      // Telefon: Nummer und Zähler mit Kürzel in Zeile 2.
      id: 'numbers',
      header: t('col.number'),
      mobile: 'meta',
      className: 'admin-dt__phone-only',
      cell: (view) =>
        [
          view.transactionNumber !== null ? t('shortNumber', { number: view.transactionNumber }) : null,
          view.signatureCounter !== null ? t('shortCounter', { counter: view.signatureCounter }) : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    {
      id: 'amount',
      header: t('col.amount'),
      num: true,
      mobile: 'trailing',
      cell: (view) => amount(view),
    },
  ];

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
          <AdminTable
            flush={false}
            className="tse-tx-list"
            caption={t('title')}
            rows={items}
            rowKey="id"
            columns={columns}
            // Klick (oder Enter) auf eine Zeile zeigt die TSE-Angaben darunter.
            onRowClick={(view) => toggle(view.id)}
            rowClassName={(view) => (view.id === open ? 'is-open' : undefined)}
            loading={query.isPlaceholderData && query.isFetching}
            footer={
              pages > 1 ? (
                <AdminPager
                  page={page + 1}
                  pageSize={TSE_TRANSACTIONS_PAGE_SIZE}
                  total={total}
                  onChange={(next) => {
                    setPage(next - 1);
                    setOpen(null);
                  }}
                />
              ) : undefined
            }
          />

          {/* DataTable kennt keine aufklappbaren Zeilen: die Angaben des
              gewählten Vorgangs stehen in einem Feld unter der Tabelle. */}
          {selected && (
            <section
              ref={detailRef}
              className="tse-tx__panel"
              aria-label={t('detailTitle', { kind: tKind(selected.kind), time: formatDateTime(selected.createdAt) })}
            >
              <div className="tse-tx__panel-head">
                <b>{t('detailTitle', { kind: tKind(selected.kind), time: formatDateTime(selected.createdAt) })}</b>
                <IconButton
                  variant="quiet"
                  size="sm"
                  icon="x"
                  label={tCommon('close')}
                  onClick={() => setOpen(null)}
                />
              </div>
              <TransactionDetail view={selected} />
            </section>
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
