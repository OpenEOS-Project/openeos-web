'use client';

import { useTranslations } from 'next-intl';
import type { DataColumn } from '@openeos/ui';

import type { DeviceReport } from '@/types/report';
import { useLocaleFormat } from '@/hooks/use-locale-format';
import { AdminTable } from '@/components/shared/admin-table';
import { downloadCsv } from './csv-export';
import { PhoneLabel, ReportCardHead, ReportLoading } from './report-table';

interface ReportsDevicesTableProps {
  data: DeviceReport[] | undefined;
  isLoading: boolean;
  /** „Nur Bons“: nur Bestellungen je Gerät — kein Umsatz. */
  orderOnly?: boolean;
}

export function ReportsDevicesTable({ data, isLoading, orderOnly = false }: ReportsDevicesTableProps) {
  const t = useTranslations('reports');
  const { formatCurrency } = useLocaleFormat();
  // „Nur Bons“: OpenEOS erfasst kein Geld — die Umsatzspalte entfällt.
  const showAmounts = !orderOnly;

  const handleExport = () => {
    if (!data?.length) return;
    const headers = [
      t('devices.columns.device'),
      t('devices.columns.orders'),
      ...(showAmounts ? [t('devices.columns.revenue')] : []),
    ];
    const rows: (string | number)[][] = data.map((d) => [d.name, d.orders, ...(showAmounts ? [d.revenue] : [])]);
    downloadCsv(t('export.filenames.devices'), headers, rows);
  };

  const columns: DataColumn<DeviceReport>[] = [
    {
      id: 'device',
      header: t('devices.columns.device'),
      mobile: 'title',
      cell: (d) => <span title={d.name}>{d.name}</span>,
    },
    {
      id: 'orders',
      header: t('devices.columns.orders'),
      num: true,
      mobile: showAmounts ? 'meta' : 'trailing',
      cell: (d) => <PhoneLabel label={t('devices.columns.orders')}>{d.orders}</PhoneLabel>,
    },
    ...(showAmounts
      ? [
          {
            id: 'revenue',
            header: t('devices.columns.revenue'),
            num: true,
            mobile: 'trailing',
            cell: (d) => formatCurrency(d.revenue),
          } satisfies DataColumn<DeviceReport>,
        ]
      : []),
  ];

  return (
    <div className="app-card app-card--flat">
      <ReportCardHead
        title={orderOnly ? t('orderOnly.devicesTitle') : t('devices.title')}
        subtitle={t('devices.subtitle')}
        onExport={handleExport}
        exportDisabled={!data?.length}
      />

      {isLoading ? (
        <ReportLoading />
      ) : !data || data.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state__title">{t('devices.empty')}</h3>
        </div>
      ) : (
        <AdminTable
          className="report-dt"
          caption={orderOnly ? t('orderOnly.devicesTitle') : t('devices.title')}
          rows={data}
          rowKey={(d) => d.deviceId ?? 'unknown'}
          columns={columns}
        />
      )}
    </div>
  );
}
