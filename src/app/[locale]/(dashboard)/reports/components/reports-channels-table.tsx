'use client';

import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { ChannelReport } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { AdminTable } from '@/components/shared/admin-table';
import { downloadCsv } from './csv-export';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';
import { getChannelLabel } from './report-labels';

interface ReportsChannelsTableProps {
  data: ChannelReport[] | undefined;
  isLoading: boolean;
  /** „Nur Bons“: nur Bestellungen je Kanal — kein Umsatz, kein Ø Bon. */
  orderOnly?: boolean;
}

export function ReportsChannelsTable({ data, isLoading, orderOnly = false }: ReportsChannelsTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();
  // „Nur Bons“: OpenEOS erfasst kein Geld — Umsatz und Ø Bon entfallen.
  const showAmounts = !orderOnly;

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('channels.columns.channel'),
      t('channels.columns.orders'),
      ...(showAmounts ? [t('channels.columns.revenue'), t('channels.columns.avgReceipt')] : []),
    ];
    const rows: (string | number)[][] = data.map((c) => [
      getChannelLabel(c.channel, t),
      c.orders,
      ...(showAmounts ? [c.revenue, c.avgReceipt] : []),
    ]);
    downloadCsv(t('export.filenames.channels'), headers, rows);
  };

  const columns: DataColumn<ChannelReport>[] = [
    {
      id: 'channel',
      header: t('channels.columns.channel'),
      mobile: 'title',
      cell: (c) => getChannelLabel(c.channel, t),
    },
    {
      id: 'orders',
      header: t('channels.columns.orders'),
      num: true,
      mobile: showAmounts ? 'meta' : 'trailing',
      cell: (c) => <PhoneLabel label={t('channels.columns.orders')}>{c.orders}</PhoneLabel>,
    },
    ...(showAmounts
      ? ([
          {
            id: 'revenue',
            header: t('channels.columns.revenue'),
            num: true,
            mobile: 'trailing',
            cell: (c) => formatCurrency(c.revenue),
          },
          {
            id: 'avgReceipt',
            header: t('channels.columns.avgReceipt'),
            num: true,
            mobile: 'meta',
            cell: (c) => <PhoneLabel label={t('channels.columns.avgReceipt')}>{formatCurrency(c.avgReceipt)}</PhoneLabel>,
          },
        ] satisfies DataColumn<ChannelReport>[])
      : []),
  ];

  return (
    <div className="app-card app-card--flat">
      <ReportCardHead
        title={orderOnly ? t('orderOnly.channelsTitle') : t('channels.title')}
        subtitle={t('channels.subtitle')}
        onExport={handleExport}
        exportDisabled={!data?.length}
      />

      {isLoading ? (
        <ReportLoading />
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('channels.empty')}</h3>
        </div>
      ) : (
        <AdminTable
          className="report-dt"
          caption={orderOnly ? t('orderOnly.channelsTitle') : t('channels.title')}
          rows={data}
          rowKey="channel"
          columns={columns}
        />
      )}
    </div>
  );
}
