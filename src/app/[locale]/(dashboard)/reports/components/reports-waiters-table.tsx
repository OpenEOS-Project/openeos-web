'use client';

import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import { useLocaleFormat } from '@/hooks/use-locale-format';
import { textOn, waiterInitials } from '@/lib/waiters';
import type { WaiterReportRow } from '@/types/waiter';
import { AdminTable, CellMain } from '@/components/shared/admin-table';
import { downloadCsv } from './csv-export';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';

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

  /* Viele Zahlenspalten: Bar und Karte stehen unter „Kassiert“, Seltenes
     fällt auf schmaleren Bildschirmen weg (CSV und breite Ansicht zeigen alles).
     Telefon: Name, rechts Kassiert (bzw. Bestellungen), darunter Bestellungen
     und offene Tische. */
  const amountColumns: DataColumn<WaiterReportRow>[] = [
    {
      id: 'collected',
      header: t('columns.collected'),
      num: true,
      mobile: 'trailing',
      cell: (r) => (
        <span className="report-num-stack">
          <span>{money(r.collected)}</span>
          <span className="report-num-stack__sub">
            {t('columns.cash')} {money(r.cashAmount)}
          </span>
          <span className="report-num-stack__sub">
            {t('columns.card')} {money(r.cardAmount)}
          </span>
        </span>
      ),
    },
    { id: 'tips', header: t('columns.tips'), num: true, priority: 3, cell: (r) => money(r.tips) },
    {
      id: 'refunds',
      header: t('columns.refunds'),
      num: true,
      priority: 2,
      cell: (r) => (r.refundCount ? money(-(r.refunds ?? 0)) : '—'),
    },
    {
      id: 'pfand',
      header: t('columns.pfand'),
      num: true,
      priority: 3,
      cell: (r) => (r.pfandReturned ? money(-r.pfandReturned) : '—'),
    },
  ];

  const columns: DataColumn<WaiterReportRow>[] = [
    {
      id: 'waiter',
      header: t('columns.waiter'),
      mobile: 'title',
      cell: (r) => (
        <CellMain
          media={
            r.kind !== 'none' ? (
              <span
                aria-hidden
                className="report-waiter__avatar"
                style={{
                  background: r.color ?? 'var(--ink)',
                  color: r.color ? textOn(r.color) : 'var(--paper)',
                }}
              >
                {waiterInitials(r.name)}
              </span>
            ) : undefined
          }
          title={name(r)}
          titleText={name(r)}
          sub={r.kind === 'member' ? t('member') : undefined}
        />
      ),
    },
    {
      id: 'orders',
      header: t('columns.orders'),
      num: true,
      mobile: showAmounts ? 'meta' : 'trailing',
      cell: (r) => <PhoneLabel label={t('columns.orders')}>{r.orders}</PhoneLabel>,
    },
    { id: 'items', header: t('columns.items'), num: true, priority: 3, cell: (r) => r.items },
    ...(showAmounts ? amountColumns : []),
    { id: 'settlements', header: t('columns.settlements'), num: true, priority: 2, cell: (r) => r.settlements },
    {
      id: 'open',
      header: t('columns.open'),
      num: true,
      mobile: 'meta',
      cell: (r) => (r.openOrders ? <PhoneLabel label={t('columns.open')}>{r.openOrders}</PhoneLabel> : '—'),
    },
  ];

  return (
    <div className="app-card app-card--flat" data-testid="reports-waiters">
      <ReportCardHead title={t('title')} subtitle={t('subtitle')} onExport={handleExport} exportDisabled={!rows.length} />

      {isLoading ? (
        <ReportLoading />
      ) : (
        <AdminTable
          className="report-dt report-dt--wide"
          caption={t('title')}
          rows={rows}
          rowKey={(r) => r.waiterId ?? r.userId ?? 'none'}
          columns={columns}
        />
      )}
    </div>
  );
}
