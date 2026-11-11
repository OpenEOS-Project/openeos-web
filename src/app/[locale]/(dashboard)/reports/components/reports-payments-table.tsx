'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { PaymentReport } from '@/types/report';
import { formatCurrency, formatPercent } from '@/utils/format';
import { AdminTable } from '@/components/shared/admin-table';
import { downloadCsv } from './csv-export';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';
import { getMethodLabel } from './report-labels';

interface ReportsPaymentsTableProps {
  data: PaymentReport[] | undefined;
  isLoading: boolean;
  /** „Nur Bons“: OpenEOS erfasst keine Zahlungen (auch keine Online-Vorkasse) — die Karte entfällt. */
  orderOnly?: boolean;
}

export function ReportsPaymentsTable({ data, isLoading, orderOnly = false }: ReportsPaymentsTableProps) {
  const t = useTranslations('reports');
  const locale = useLocale();

  if (orderOnly) return null;

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('payments.columns.method'),
      t('payments.columns.count'),
      t('payments.columns.total'),
      t('payments.columns.percentage'),
    ];
    const rows = data.map((p) => [
      getMethodLabel(p.method, t),
      p.count,
      p.total,
      formatPercent(p.percentage, locale),
    ]);
    downloadCsv(t('export.filenames.payments'), headers, rows);
  };

  const columns: DataColumn<PaymentReport>[] = [
    {
      id: 'method',
      header: t('payments.columns.method'),
      mobile: 'title',
      cell: (p) => getMethodLabel(p.method, t),
    },
    {
      id: 'count',
      header: t('payments.columns.count'),
      num: true,
      mobile: 'meta',
      cell: (p) => <PhoneLabel label={t('payments.columns.count')}>{p.count}</PhoneLabel>,
    },
    {
      id: 'total',
      header: t('payments.columns.total'),
      num: true,
      mobile: 'trailing',
      cell: (p) => formatCurrency(p.total, locale),
    },
    {
      id: 'percentage',
      header: t('payments.columns.percentage'),
      num: true,
      mobile: 'meta',
      cell: (p) => (
        <span className="report-share">
          <span className="report-share__bar" aria-hidden>
            <span style={{ width: `${Math.min(p.percentage, 100)}%` }} />
          </span>
          <span className="report-share__value">
            <PhoneLabel label={t('payments.columns.percentage')}>{formatPercent(p.percentage, locale)}</PhoneLabel>
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="app-card app-card--flat">
      <ReportCardHead
        title={t('payments.title')}
        subtitle={t('payments.subtitle')}
        onExport={handleExport}
        exportDisabled={!data?.length}
      />

      {isLoading ? (
        <ReportLoading />
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('payments.empty')}</h3>
        </div>
      ) : (
        <AdminTable className="report-dt" caption={t('payments.title')} rows={data} rowKey="method" columns={columns} />
      )}
    </div>
  );
}
