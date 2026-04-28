'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printersApi } from '@/lib/api-client';
import type { Printer, CreatePrinterData, UpdatePrinterData } from '@/types/printer';

export function usePrinters(organizationId: string) {
  return useQuery({
    queryKey: ['printers', organizationId],
    queryFn: async () => {
      const res = await printersApi.list(organizationId);
      return res.data as unknown as Printer[];
    },
    enabled: !!organizationId,
  });
}

export function useCreatePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePrinterData) =>
      printersApi.create(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers', organizationId] });
    },
  });
}

export function useUpdatePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ printerId, data }: { printerId: string; data: UpdatePrinterData }) =>
      printersApi.update(organizationId, printerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers', organizationId] });
    },
  });
}

export function useDeletePrinter(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (printerId: string) =>
      printersApi.delete(organizationId, printerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printers', organizationId] });
    },
  });
}

export function useTestPrint(organizationId: string) {
  return useMutation({
    mutationFn: (printerId: string) =>
      printersApi.testPrint(organizationId, printerId),
  });
}
