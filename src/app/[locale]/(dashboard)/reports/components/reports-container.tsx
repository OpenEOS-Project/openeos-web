'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building } from 'lucide-react';
import { Banner, Icon } from '@openeos/ui';

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
  useNetSalesSummary,
  useVatReport,
  useWaitersReport,
} from '@/hooks/use-reports';
import { ListEmpty } from '@/components/shared/list-states';
import { useOperatingMode } from '@/hooks/use-operating-mode';

import { ReportsFilterBar, type ReportsFilter, type TimeRange } from './reports-filter-bar';
import { ReportsKpiCards } from './reports-kpi-cards';
import { ReportsProductsTable } from './reports-products-table';
import { ReportsPaymentsTable } from './reports-payments-table';
import { ReportsHourlyChart } from './reports-hourly-chart';
import { ReportsChannelsTable } from './reports-channels-table';
import { ReportsCategoriesTable } from './reports-categories-table';
import { ReportsDevicesTable } from './reports-devices-table';
import { ReportsWaitersTable } from './reports-waiters-table';
import { ReportsVatTable } from './reports-vat-table';
import { PdfExportButton } from './pdf-export-button';
import { todayKey } from '@/utils/calendar-date';

function getTodayRange(): { startDate: string; endDate: string } {
  const today = todayKey();
  return { startDate: today, endDate: `${today}T23:59:59` };
}

export function ReportsContainer() {
  const tCommon = useTranslations('common');
  const t = useTranslations('reports');
  /* „Nur Bons“: OpenEOS erfasst kein Geld — nur Bestellungen und Mengen, keine Beträge und keine Zahlarten. */
  const orderOnly = useOperatingMode().ordersOnly;

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
  const waitersReport = useWaitersReport(organizationId, reportQuery);
  const netSummary = useNetSalesSummary(organizationId, reportQuery);
  // „Nur Bons“: keine Beträge, also auch keine Umsatzsteuer.
  const vatReport = useVatReport(organizationId, reportQuery, !orderOnly);

  const selectedEventName = events.find((e) => e.id === filter.eventId)?.name;

  if (!organizationId) {
    return (
      <ListEmpty
        title={tCommon('noOrganization.title')}
        description={tCommon('noOrganization.description')}
        icon={
          <Building size={28} />
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
            net={netSummary.data}
            devices={devicesReport.data}
            vat={vatReport.data}
            orderOnly={orderOnly}
          />
        }
      />

      {orderOnly && (
        <Banner tone="info" icon={<Icon name="info" />}>
          {t('orderOnly.banner')}
        </Banner>
      )}

      <ReportsKpiCards data={salesReport.data} isLoading={salesReport.isLoading} orderOnly={orderOnly} />

      <ReportsProductsTable
        data={productsReport.data}
        net={netSummary.data}
        isLoading={productsReport.isLoading}
        orderOnly={orderOnly}
      />

      {!orderOnly && (
        <ReportsPaymentsTable data={paymentsReport.data} isLoading={paymentsReport.isLoading} />
      )}

      <ReportsVatTable data={vatReport.data} isLoading={vatReport.isLoading} orderOnly={orderOnly} />

      <ReportsChannelsTable data={channelsReport.data} isLoading={channelsReport.isLoading} orderOnly={orderOnly} />

      <ReportsCategoriesTable
        data={categoriesReport.data}
        net={netSummary.data}
        isLoading={categoriesReport.isLoading}
        orderOnly={orderOnly}
      />

      <ReportsDevicesTable data={devicesReport.data} isLoading={devicesReport.isLoading} orderOnly={orderOnly} />

      <ReportsWaitersTable data={waitersReport.data} isLoading={waitersReport.isLoading} orderOnly={orderOnly} />

      <ReportsHourlyChart data={hourlyReport.data} isLoading={hourlyReport.isLoading} orderOnly={orderOnly} />
    </div>
  );
}
