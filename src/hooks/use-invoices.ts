'use client';

import { useQuery } from '@tanstack/react-query';

import { billingApi } from '@/lib/api-client';

export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (organizationId: string) => [...invoiceKeys.all, 'list', organizationId] as const,
};

export function useInvoices(organizationId: string) {
  return useQuery({
    queryKey: invoiceKeys.list(organizationId),
    queryFn: async () => {
      const response = await billingApi.listInvoices(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });
}
