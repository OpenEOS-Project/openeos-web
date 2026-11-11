'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { NetSalesSummary, ProductReport } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { AdminTable, CellText } from '@/components/shared/admin-table';
import { netReconciliation } from '@/utils/report-net';
import { rankByMode } from '@/lib/operating-mode';
import { downloadCsv } from './csv-export';
import { ReportsNetSummary } from './reports-net-footer';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';

interface ReportsProductsTableProps {
  data: ProductReport[] | undefined;
  /** Abgleich mit dem Umsatz netto (Erstattungen ohne Position, Trinkgeld). */
  net?: NetSalesSummary;
  isLoading: boolean;
  /** „Nur Bons“: nach Menge sortiert, nur Mengen — keine Beträge, kein Abgleich. */
  orderOnly?: boolean;
}

export function ReportsProductsTable({ data, net, isLoading, orderOnly = false }: ReportsProductsTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();

  const sorted = useMemo(() => {
    if (!data) return [];
    return rankByMode(data, orderOnly, (p) => p.quantitySold, (p) => p.revenue);
  }, [data, orderOnly]);
  // Abgleich (Erstattungen, Trinkgeld, Umsatz netto) gibt es nur mit Kasse.
  const netLines = useMemo(
    () => (!orderOnly && net && sorted.length ? netReconciliation(sorted.map((p) => p.revenue), net) : []),
    [net, sorted, orderOnly],
  );
  // „Nur Bons“: OpenEOS erfasst kein Geld — Umsatz und Ø-Preis entfallen.
  const showAmounts = !orderOnly;

  const handleExport = () => {
    if (!sorted.length) return;
    const headers = [
      t('products.columns.product'),
      t('products.columns.category'),
      t('products.columns.quantity'),
      ...(showAmounts ? [t('products.columns.revenue'), t('products.columns.avgPrice')] : []),
    ];
    const rows: (string | number)[][] = sorted.map((p) => [
      p.productName,
      p.categoryName,
      p.quantitySold,
      ...(showAmounts ? [p.revenue, p.averagePrice] : []),
    ]);
    // Abgleichzeilen wie in der Tabelle (Summe, Erstattungen ohne Position, Trinkgeld, Umsatz netto).
    for (const line of netLines) {
      rows.push([line.key === 'items' ? t('net.items') : t(`net.${line.key}`), '', '', line.amount, '']);
    }
    downloadCsv(t('export.filenames.products'), headers, rows);
  };

  const columns: DataColumn<ProductReport>[] = [
    {
      id: 'product',
      header: t('products.columns.product'),
      mobile: 'title',
      cell: (p) => <span title={p.productName}>{p.productName}</span>,
    },
    {
      id: 'category',
      header: t('products.columns.category'),
      mobile: 'meta',
      cell: (p) => (
        <CellText muted title={p.categoryName}>
          {p.categoryName}
        </CellText>
      ),
    },
    {
      id: 'quantity',
      header: t('products.columns.quantity'),
      num: true,
      mobile: showAmounts ? 'meta' : 'trailing',
      cell: (p) => <PhoneLabel label={t('products.columns.quantity')}>{p.quantitySold}</PhoneLabel>,
    },
    ...(showAmounts
      ? ([
          {
            id: 'revenue',
            header: t('products.columns.revenue'),
            num: true,
            mobile: 'trailing',
            cell: (p) => formatCurrency(p.revenue),
          },
          {
            id: 'avgPrice',
            header: t('products.columns.avgPrice'),
            num: true,
            priority: 2,
            mobile: 'meta',
            cell: (p) => <PhoneLabel label={t('products.columns.avgPrice')}>{formatCurrency(p.averagePrice)}</PhoneLabel>,
          },
        ] satisfies DataColumn<ProductReport>[])
      : []),
  ];

  return (
    <div className="app-card app-card--flat">
      <ReportCardHead
        title={t('products.title')}
        subtitle={orderOnly ? t('orderOnly.productsSubtitle') : t('products.subtitle')}
        onExport={handleExport}
        exportDisabled={!sorted.length}
      />

      {isLoading ? (
        <ReportLoading />
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('products.empty')}</h3>
        </div>
      ) : (
        <AdminTable
          className="report-dt"
          caption={t('products.title')}
          rows={sorted}
          rowKey="productId"
          columns={columns}
          footer={
            orderOnly ? undefined : (
              <ReportsNetSummary lines={netLines} itemsLabel={t('net.items')} note={t('net.note')} />
            )
          }
        />
      )}
    </div>
  );
}
