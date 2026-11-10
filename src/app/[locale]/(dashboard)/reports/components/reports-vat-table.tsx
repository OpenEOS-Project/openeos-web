'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { VatReport } from '@/types/report';
import { formatCurrency } from '@/utils/format';
import { downloadCsv } from './csv-export';

interface ReportsVatTableProps {
  data: VatReport | undefined;
  isLoading: boolean;
  /** „Nur Bons“: keine Beträge — die Karte entfällt. */
  orderOnly?: boolean;
}

/**
 * Umsatz und Umsatzsteuer je Steuersatz. Pfand gehört zum Entgelt
 * (Abschn. 10.1 Abs. 8 UStAE) und steht beim Satz seiner Pfandart;
 * Rückgaben mindern Umsatz und Steuer zum selben Satz (gegen den
 * Pfand-Altsaldo bei 0 %). Trinkgeld an den Verein ist Entgelt und steht
 * anteilig beim Satz der Ware; Trinkgeld angestellter Bedienungen nur als
 * Vermerk darunter. Ware, Pfand, Rückgaben und Trinkgeld stehen getrennt,
 * damit nachvollziehbar bleibt, woraus sich die Summe je Satz ergibt.
 */
export function ReportsVatTable({ data, isLoading, orderOnly = false }: ReportsVatTableProps) {
  const t = useTranslations('reports');
  const locale = useLocale();

  if (orderOnly) return null;

  const money = (value: number) => formatCurrency(value, locale);
  const rows = data?.rows ?? [];
  const hasLegacyDeposit = rows.some((r) => r.rate === 0 && (r.deposits !== 0 || r.depositReturns !== 0));
  const employeeTips = data?.employeeTips ?? 0;

  const handleExport = () => {
    if (!data || rows.length === 0) return;
    const headers = [
      t('vat.columns.rate'),
      t('vat.columns.goods'),
      t('vat.columns.deposits'),
      t('vat.columns.depositReturns'),
      t('vat.columns.tips'),
      t('vat.columns.gross'),
      t('vat.columns.net'),
      t('vat.columns.tax'),
    ];
    const csvRows = [
      ...rows.map((r) => [r.rate, r.goods, r.deposits, r.depositReturns, r.tips ?? 0, r.gross, r.net, r.tax]),
      [
        t('vat.total'),
        data.total.goods,
        data.total.deposits,
        data.total.depositReturns,
        data.total.tips ?? 0,
        data.total.gross,
        data.total.net,
        data.total.tax,
      ],
    ];
    downloadCsv(t('export.filenames.vat'), headers, csvRows);
  };

  return (
    <div className="app-card app-card--flat" data-testid="reports-vat">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('vat.title')}</h2>
          <p className="app-card__sub">{t('vat.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 13 }}
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          {t('export.csv')}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{t('loading')}</div>
        </div>
      ) : !data || rows.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('vat.empty')}</h3>
        </div>
      ) : (
        <>
          {data.vatExempt && (
            <p className="app-card__sub" style={{ padding: '0 20px 12px' }}>
              {t('vat.exempt')}
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('vat.columns.rate')}</th>
                  <th className="text-right">{t('vat.columns.goods')}</th>
                  <th className="text-right">{t('vat.columns.deposits')}</th>
                  <th className="text-right">{t('vat.columns.depositReturns')}</th>
                  <th className="text-right" title={t('vat.columns.tipsHint')}>{t('vat.columns.tips')}</th>
                  <th className="text-right">{t('vat.columns.gross')}</th>
                  <th className="text-right">{t('vat.columns.net')}</th>
                  <th className="text-right">{t('vat.columns.tax')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rate}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                        {t('vat.rate', { rate: r.rate })}
                      </div>
                    </td>
                    <td className="mono text-right">{money(r.goods)}</td>
                    <td className="mono text-right">{money(r.deposits)}</td>
                    <td className="mono text-right">{money(r.depositReturns)}</td>
                    <td className="mono text-right">{money(r.tips ?? 0)}</td>
                    <td className="mono text-right">{money(r.gross)}</td>
                    <td className="mono text-right">{money(r.net)}</td>
                    <td className="mono text-right">{money(r.tax)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>{t('vat.total')}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.goods)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.deposits)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.depositReturns)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.tips ?? 0)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.gross)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.net)}</b>
                  </td>
                  <td className="mono text-right">
                    <b>{money(data.total.tax)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {hasLegacyDeposit && !data.vatExempt && (
            <p className="app-card__sub" style={{ padding: '12px 20px' }}>
              {t('vat.legacyHint')}
            </p>
          )}
          {employeeTips > 0 && (
            <p className="app-card__sub" style={{ padding: '0 20px 12px' }} data-testid="reports-vat-employee-tips">
              {t('vat.employeeTips', { amount: money(employeeTips) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
