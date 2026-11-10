'use client';

import { useTranslations } from 'next-intl';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { textOn, waiterInitials } from '@/lib/waiters';
import type { WaiterReportRow } from '@/types/waiter';
import { downloadCsv } from './csv-export';

interface ReportsWaitersTableProps {
  data: WaiterReportRow[] | undefined;
  isLoading: boolean;
  /** „Nur Bons“: nur Mengen, keine Beträge. */
  orderOnly?: boolean;
}

/**
 * Bericht „Bedienungen“ (bedienungen-plan.md §7): je Bedienung bzw.
 * Mitglied aufgenommen, kassiert, Storno/Erstattungen, Pfand, Abrechnungen
 * und offene Tische. Ohne Bedienungen in der Organisation entfällt die
 * Karte.
 */
export function ReportsWaitersTable({ data, isLoading, orderOnly = false }: ReportsWaitersTableProps) {
  const t = useTranslations('reports.waiters');
  const tReports = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();
  const showAmounts = !orderOnly;
  const rows = data ?? [];
  if (!isLoading && !rows.some((r) => r.kind === 'waiter')) return null;

  const name = (row: WaiterReportRow) => (row.kind === 'none' ? t('none') : row.name);
  const money = (value: number | undefined) => formatCurrency(value ?? 0);

  const handleExport = () => {
    if (!rows.length) return;
    const headers = [
      t('columns.waiter'),
      t('columns.orders'),
      t('columns.items'),
      ...(showAmounts
        ? [
            t('columns.revenue'),
            t('columns.collected'),
            t('columns.cash'),
            t('columns.card'),
            t('columns.other'),
            t('columns.tips'),
            t('columns.refunds'),
            t('columns.pfand'),
          ]
        : []),
      t('columns.settlements'),
      t('columns.open'),
    ];
    const lines: (string | number)[][] = rows.map((r) => [
      name(r),
      r.orders,
      r.items,
      ...(showAmounts
        ? [
            r.revenue ?? 0,
            r.collected ?? 0,
            r.cashAmount ?? 0,
            r.cardAmount ?? 0,
            r.otherAmount ?? 0,
            r.tips ?? 0,
            r.refunds ?? 0,
            r.pfandReturned ?? 0,
          ]
        : []),
      r.settlements,
      r.openOrders,
    ]);
    downloadCsv(t('filename'), headers, lines);
  };

  return (
    <div className="app-card app-card--flat" data-testid="reports-waiters">
      <div className="app-card__head">
        <div>
          <h2 className="app-card__title">{t('title')}</h2>
          <p className="app-card__sub">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ fontSize: 13 }}
          onClick={handleExport}
          disabled={!rows.length}
        >
          {tReports('export.csv')}
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--ink)', opacity: 0.5 }}>{tReports('loading')}</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('columns.waiter')}</th>
                <th className="text-right">{t('columns.orders')}</th>
                <th className="text-right">{t('columns.items')}</th>
                {showAmounts && (
                  <>
                    <th className="text-right">{t('columns.collected')}</th>
                    <th className="text-right">{t('columns.cash')}</th>
                    <th className="text-right">{t('columns.card')}</th>
                    <th className="text-right">{t('columns.tips')}</th>
                    <th className="text-right">{t('columns.refunds')}</th>
                    <th className="text-right">{t('columns.pfand')}</th>
                  </>
                )}
                <th className="text-right">{t('columns.settlements')}</th>
                <th className="text-right">{t('columns.open')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.waiterId ?? r.userId ?? 'none'}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.kind !== 'none' && (
                        <span
                          aria-hidden
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'inline-grid',
                            placeItems: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                            background: r.color ?? 'var(--ink)',
                            color: r.color ? textOn(r.color) : 'var(--paper)',
                          }}
                        >
                          {waiterInitials(r.name)}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {name(r)}
                        {r.kind === 'member' && (
                          <small style={{ display: 'block', fontWeight: 400, opacity: 0.6 }}>{t('member')}</small>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="mono text-right">{r.orders}</td>
                  <td className="mono text-right">{r.items}</td>
                  {showAmounts && (
                    <>
                      <td className="mono text-right">{money(r.collected)}</td>
                      <td className="mono text-right">{money(r.cashAmount)}</td>
                      <td className="mono text-right">{money(r.cardAmount)}</td>
                      <td className="mono text-right">{money(r.tips)}</td>
                      <td className="mono text-right">{r.refundCount ? money(-(r.refunds ?? 0)) : '—'}</td>
                      <td className="mono text-right">{r.pfandReturned ? money(-r.pfandReturned) : '—'}</td>
                    </>
                  )}
                  <td className="mono text-right">{r.settlements}</td>
                  <td className="mono text-right">{r.openOrders || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
