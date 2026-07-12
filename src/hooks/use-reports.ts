'use client';

import { useQuery } from '@tanstack/react-query';

import { reportsApi } from '@/lib/api-client';
import type { ReportQuery } from '@/types/report';

export const reportKeys = {
  all: ['reports'] as const,
  scope: (organizationId: string, kind: string, params?: ReportQuery) =>
    [...reportKeys.all, organizationId, kind, params ?? {}] as const,
};

function useReport<T>(
  organizationId: string,
  kind:
    | 'sales'
    | 'products'
    | 'payments'
    | 'hourly'
    | 'channels'
    | 'categories'
    | 'devices'
    | 'inventory'
    | 'stock-movements',
  fetcher: () => Promise<{ data: T }>,
  params?: ReportQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.scope(organizationId, kind, params),
    queryFn: async () => (await fetcher()).data,
    enabled: !!organizationId && enabled,
  });
}

export function useSalesReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'sales', () => reportsApi.getSales(organizationId, params), params, enabled);
}

export function useProductsReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'products', () => reportsApi.getProducts(organizationId, params), params, enabled);
}

export function usePaymentsReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'payments', () => reportsApi.getPayments(organizationId, params), params, enabled);
}

export function useHourlyReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'hourly', () => reportsApi.getHourly(organizationId, params), params, enabled);
}

export function useChannelsReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'channels', () => reportsApi.getChannels(organizationId, params), params, enabled);
}

export function useCategoriesReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(
    organizationId,
    'categories',
    () => reportsApi.getCategories(organizationId, params),
    params,
    enabled,
  );
}

export function useDevicesReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'devices', () => reportsApi.getDevices(organizationId, params), params, enabled);
}

export function useInventoryReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(organizationId, 'inventory', () => reportsApi.getInventory(organizationId, params), params, enabled);
}

export function useStockMovementsReport(organizationId: string, params?: ReportQuery, enabled = true) {
  return useReport(
    organizationId,
    'stock-movements',
    () => reportsApi.getStockMovements(organizationId, params),
    params,
    enabled,
  );
}
