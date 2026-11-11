'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { getMethodLabel } from '@/app/[locale]/(dashboard)/reports/components/report-labels';
import { useApiErrorMessage } from '@/hooks/use-api-error-message';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { useTokenTransactions, type TokenReportQuery } from '@/hooks/use-token-types';
import { signedTransactionAmount, tokenLinesLabel } from '@/lib/token-admin';

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
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" data-testid="tokens-transactions">
          <thead>
            <tr>
              <th>{t('columns.time')}</th>
              <th>{t('columns.number')}</th>
              <th>{t('columns.kind')}</th>
              <th>{t('columns.tokens')}</th>
              <th className="text-right">{t('columns.amount')}</th>
              <th>{t('columns.method')}</th>
              <th>{t('columns.actor')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDateTime(tx.createdAt)}</td>
                <td className="mono" style={{ fontSize: 13 }}>
                  {tx.transactionNumber}
                </td>
                <td>
                  <span className={tx.kind === 'buyback' ? 'badge badge--warning' : 'badge badge--success'}>
                    {t(`kind.${tx.kind}`)}
                  </span>
                  {tx.isTest && (
                    <span className="badge badge--neutral" style={{ marginLeft: 4 }}>
                      {t('test')}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>
                  {tokenLinesLabel(tx.lines, locale)}
                  {tx.reason && <div style={{ fontSize: 11, color: 'var(--oe-mute)' }}>{tx.reason}</div>}
                </td>
                <td className="mono text-right">{formatCurrency(signedTransactionAmount(tx))}</td>
                <td style={{ fontSize: 13 }}>{getMethodLabel(tx.paymentMethod, tReports)}</td>
                <td style={{ fontSize: 13 }}>{tx.actorName ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
