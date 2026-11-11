'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { CategoryReport, NetSalesSummary } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { AdminTable } from '@/components/shared/admin-table';
import { netReconciliation } from '@/utils/report-net';
import { rankByMode } from '@/lib/operating-mode';
import { downloadCsv } from './csv-export';
import { ReportsNetSummary } from './reports-net-footer';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';

interface ReportsCategoriesTableProps {
  data: CategoryReport[] | undefined;
  /** Abgleich mit dem Umsatz netto (Erstattungen ohne Position, Trinkgeld). */
  net?: NetSalesSummary;
  isLoading: boolean;
  /** „Nur Bons“: nach Menge sortiert, nur Mengen — keine Beträge, kein Abgleich. */
  orderOnly?: boolean;
}

export function ReportsCategoriesTable({ data: raw, net, isLoading, orderOnly = false }: ReportsCategoriesTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();
  const data = useMemo(
    () => (raw && orderOnly ? rankByMode(raw, true, (c) => c.quantity, (c) => c.revenue) : raw),
    [raw, orderOnly],
  );
  // Abgleich (Erstattungen, Trinkgeld, Umsatz netto) gibt es nur mit Kasse.
  const netLines = useMemo(
    () => (!orderOnly && net && data?.length ? netReconciliation(data.map((c) => c.revenue), net) : []),
    [net, data, orderOnly],
  );
  // „Nur Bons“: OpenEOS erfasst kein Geld — die Umsatzspalte entfällt.
  const showAmounts = !orderOnly;

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('categories.columns.category'),
      t('categories.columns.quantity'),
      ...(showAmounts ? [t('categories.columns.revenue')] : []),
    ];
    const rows: (string | number)[][] = data.map((c) => [
      c.name,
      c.quantity,
      ...(showAmounts ? [c.revenue] : []),
    ]);
    for (const line of netLines) {
      rows.push([line.key === 'items' ? t('net.categoryItems') : t(`net.${line.key}`), '', line.amount]);
    }
    downloadCsv(t('export.filenames.categories'), headers, rows);
  };

  const columns: DataColumn<CategoryReport>[] = [
    {
      id: 'category',
      header: t('categories.columns.category'),
      mobile: 'title',
      cell: (c) => <span title={c.name}>{c.name}</span>,
    },
    {
      id: 'quantity',
      header: t('categories.columns.quantity'),
      num: true,
      mobile: showAmounts ? 'meta' : 'trailing',
      cell: (c) => <PhoneLabel label={t('categories.columns.quantity')}>{c.quantity}</PhoneLabel>,
    },
    ...(showAmounts
      ? [
          {
            id: 'revenue',
            header: t('categories.columns.revenue'),
            num: true,
            mobile: 'trailing',
            cell: (c) => formatCurrency(c.revenue),
          } satisfies DataColumn<CategoryReport>,
        ]
      : []),
  ];

  return (
    <div className="app-card app-card--flat">
      <ReportCardHead
        title={t('categories.title')}
        subtitle={orderOnly ? t('orderOnly.categoriesSubtitle') : t('categories.subtitle')}
        onExport={handleExport}
        exportDisabled={!data?.length}
      />

      {isLoading ? (
        <ReportLoading />
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('categories.empty')}</h3>
        </div>
      ) : (
        <AdminTable
          className="report-dt"
          caption={t('categories.title')}
          rows={data}
          rowKey="categoryId"
          columns={columns}
          footer={
            orderOnly ? undefined : (
              <ReportsNetSummary lines={netLines} itemsLabel={t('net.categoryItems')} note={t('net.note')} />
            )
          }
        />
      )}
    </div>
  );
}
