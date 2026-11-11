'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { type DataColumn } from '@openeos/ui';

import { getMethodLabel } from '@/app/[locale]/(dashboard)/reports/components/report-labels';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useTokenTransactions, type TokenReportQuery } from '@/hooks/use-token-types';
import { signedTransactionAmount, tokenLinesLabel } from '@/lib/token-admin';
import { AdminTable, CellMain, CellNone } from '@/components/shared/admin-table';
import '@/styles/admin-table-wave2.css';
import type { TokenTransaction } from '@/types/token';

const LIMIT = 50;

/** Letzte Verkäufe und Rücktausche von Wertmarken (neueste zuerst, höchstens 50). */
export function TokensTransactions({ organizationId, query }: { organizationId: string; query: TokenReportQuery }) {
  const t = useTranslations('tokens.transactions');
  const tReports = useTranslations('reports');
  const locale = useLocale();
  const apiErrorMessage = useApiErrorMessage();
  const { formatCurrency, formatDateTime } = useLocaleFormat();
  const [kind, setKind] = useState<'' | 'sale' | 'buyback'>('');
  const list = useTokenTransactions(organizationId, { ...query, kind: kind || undefined, limit: LIMIT });
  const rows = list.data ?? [];

  const columns: DataColumn<TokenTransaction>[] = [
    { id: 'time', header: t('columns.time'), mobile: 'meta', className: 'token-tx__time', cell: (tx) => formatDateTime(tx.createdAt) },
    { id: 'number', header: t('columns.number'), priority: 3, className: 'token-tx__number', cell: (tx) => tx.transactionNumber },
    {
      id: 'kind',
      header: t('columns.kind'),
      mobile: 'subtitle',
      cell: (tx) => (
        <span className="token-kind">
          <span className={tx.kind === 'buyback' ? 'badge badge--warning' : 'badge badge--success'}>{t(`kind.${tx.kind}`)}</span>
          {tx.isTest && <span className="badge badge--neutral">{t('test')}</span>}
        </span>
      ),
    },
    {
      id: 'tokens',
      header: t('columns.tokens'),
      mobile: 'title',
      cell: (tx) => {
        const label = tokenLinesLabel(tx.lines, locale);
        return <CellMain title={label} titleText={label} sub={tx.reason ?? undefined} subText={tx.reason ?? undefined} />;
      },
    },
    { id: 'amount', header: t('columns.amount'), num: true, mobile: 'trailing', cell: (tx) => formatCurrency(signedTransactionAmount(tx)) },
    { id: 'method', header: t('columns.method'), mobile: 'meta', cell: (tx) => getMethodLabel(tx.paymentMethod, tReports) },
    { id: 'actor', header: t('columns.actor'), priority: 2, cell: (tx) => tx.actorName ?? <CellNone /> },
  ];

  let body;
  if (list.isLoading)
    body = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div className="spinner" role="status" aria-label={t('loading')} />
      </div>
    );
  else if (list.error)
    body = (
      <p role="alert" className="app-card__sub" style={{ padding: '0 20px 20px', color: 'var(--danger)' }}>
        {apiErrorMessage(list.error, t('loadFailed'))}
      </p>
    );
  else if (rows.length === 0)
    body = (
      <div className="empty-state">
        <h3 className="empty-state__title">{t('empty')}</h3>
      </div>
    );
  else
    body = (
      <div data-testid="tokens-transactions">
        <AdminTable<TokenTransaction>
          caption={t('title')}
          rows={rows}
          rowKey="id"
          columns={columns}
        />
      </div>
    );

  return (
    <div className="app-card app-card--flat" data-testid="tokens-transactions-card">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle', { limit: LIMIT })}</p>
        </div>
        <select
          className="select"
          style={{ padding: '7px 10px', fontSize: 13 }}
          value={kind}
          onChange={(e) => setKind(e.target.value as '' | 'sale' | 'buyback')}
          aria-label={t('filter')}
        >
          <option value="">{t('kind.all')}</option>
          <option value="sale">{t('kind.sale')}</option>
          <option value="buyback">{t('kind.buyback')}</option>
        </select>
      </div>
      {body}
    </div>
  );
}
