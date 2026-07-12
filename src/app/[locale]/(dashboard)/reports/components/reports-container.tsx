'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/stores/auth-store';
import { useEvents, useActiveEvent } from '@/hooks/use-events';
import {
  useSalesReport,
  useProductsReport,
  usePaymentsReport,
  useHourlyReport,
  useChannelsReport,
  useCategoriesReport,
  useDevicesReport,
} from '@/hooks/use-reports';
import { ListEmpty } from '@/components/shared/list-states';

import { ReportsFilterBar, type ReportsFilter, type TimeRange } from './reports-filter-bar';
import { ReportsKpiCards } from './reports-kpi-cards';
import { ReportsProductsTable } from './reports-products-table';
import { ReportsPaymentsTable } from './reports-payments-table';
import { ReportsHourlyChart } from './reports-hourly-chart';
import { ReportsChannelsTable } from './reports-channels-table';
import { ReportsCategoriesTable } from './reports-categories-table';
import { ReportsDevicesTable } from './reports-devices-table';
import { PdfExportButton } from './pdf-export-button';

function getTodayRange(): { startDate: string; endDate: string } {
  const today = new Date().toISOString().split('T')[0];
  return { startDate: today, endDate: `${today}T23:59:59` };
}

export function ReportsContainer() {
  const t = useTranslations('reports');

  const currentOrganization = useAuthStore((state) => state.currentOrganization);
  const organizationId = currentOrganization?.organizationId ?? '';

  const { data: events = [], isLoading: eventsLoading } = useEvents(organizationId);
  const { data: activeEvent } = useActiveEvent(organizationId);

  const [filter, setFilter] = useState<ReportsFilter>(() => {
    const { startDate, endDate } = getTodayRange();
    return { eventId: '', timeRange: 'today' as TimeRange, startDate, endDate };
  });

  // Pre-select the active event on first load if the user hasn't changed the event filter
  const activeEventId = activeEvent?.id;
  useEffect(() => {
    if (activeEventId) {
      setFilter((prev) => (prev.eventId === '' ? { ...prev, eventId: activeEventId } : prev));
    }
  }, [activeEventId]);

  const reportQuery = useMemo(
    () => ({
      eventId: filter.eventId || undefined,
      startDate: filter.startDate || undefined,
      endDate: filter.endDate || undefined,
    }),
    [filter.eventId, filter.startDate, filter.endDate],
  );

  const salesReport = useSalesReport(organizationId, reportQuery);
  const productsReport = useProductsReport(organizationId, reportQuery);
  const paymentsReport = usePaymentsReport(organizationId, reportQuery);
  const hourlyReport = useHourlyReport(organizationId, reportQuery);
  const channelsReport = useChannelsReport(organizationId, reportQuery);
  const categoriesReport = useCategoriesReport(organizationId, reportQuery);
  const devicesReport = useDevicesReport(organizationId, reportQuery);

  const selectedEventName = events.find((e) => e.id === filter.eventId)?.name;

  if (!organizationId) {
    return (
      <ListEmpty
        title={t('noOrg.title')}
        description={t('noOrg.description')}
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
          </svg>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ReportsFilterBar
        filter={filter}
        events={events}
        eventsLoading={eventsLoading}
        onChange={setFilter}
        actions={
          <PdfExportButton
            organizationName={currentOrganization?.organization?.name}
            eventName={selectedEventName}
            filter={filter}
            sales={salesReport.data}
            products={productsReport.data}
            payments={paymentsReport.data}
            hourly={hourlyReport.data}
            channels={channelsReport.data}
            categories={categoriesReport.data}
            devices={devicesReport.data}
          />
        }
      />

      <ReportsKpiCards data={salesReport.data} isLoading={salesReport.isLoading} />

      <ReportsProductsTable data={productsReport.data} isLoading={productsReport.isLoading} />

      <ReportsPaymentsTable data={paymentsReport.data} isLoading={paymentsReport.isLoading} />

      <ReportsChannelsTable data={channelsReport.data} isLoading={channelsReport.isLoading} />

      <ReportsCategoriesTable data={categoriesReport.data} isLoading={categoriesReport.isLoading} />

      <ReportsDevicesTable data={devicesReport.data} isLoading={devicesReport.isLoading} />

      <ReportsHourlyChart data={hourlyReport.data} isLoading={hourlyReport.isLoading} />
    </div>
  );
}
