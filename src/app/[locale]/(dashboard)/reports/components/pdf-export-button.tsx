'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type {
  SalesReport,
  ProductReport,
  PaymentReport,
  HourlyReport,
  ChannelReport,
  CategoryReport,
  DeviceReport,
} from '@/types/report';
import type { ReportsFilter } from './reports-filter-bar';
import { generateReportsPdf } from './pdf-export';

interface PdfExportButtonProps {
  organizationName?: string;
  eventName?: string;
  filter: ReportsFilter;
  sales?: SalesReport;
  products?: ProductReport[];
  payments?: PaymentReport[];
  hourly?: HourlyReport[];
  channels?: ChannelReport[];
  categories?: CategoryReport[];
  devices?: DeviceReport[];
}

export function PdfExportButton(props: PdfExportButtonProps) {
  const t = useTranslations('reports');
  const [isPending, setIsPending] = useState(false);

  const handleExport = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await generateReportsPdf(props);
    } catch (error) {
      console.error('PDF export failed', error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn--primary"
      style={{ fontSize: 13, padding: '7px 14px' }}
      onClick={handleExport}
      disabled={isPending}
    >
      {isPending ? t('export.pdfPending') : t('export.pdf')}
    </button>
  );
}
