'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printTemplatesApi } from '@/lib/api-client';
import type {
  PrintTemplate,
  CreatePrintTemplateData,
  UpdatePrintTemplateData,
} from '@/types/print-template';

export function usePrintTemplates(organizationId: string) {
  return useQuery({
    queryKey: ['print-templates', organizationId],
    queryFn: async () => {
      const res = await printTemplatesApi.list(organizationId);
      return res.data as unknown as PrintTemplate[];
    },
    enabled: !!organizationId,
  });
}

export function usePrintTemplate(organizationId: string, templateId: string) {
  return useQuery({
    queryKey: ['print-templates', organizationId, templateId],
    queryFn: async () => {
      const res = await printTemplatesApi.get(organizationId, templateId);
      return res.data as unknown as PrintTemplate;
    },
    enabled: !!organizationId && !!templateId,
  });
}

export function useCreatePrintTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePrintTemplateData) =>
      printTemplatesApi.create(organizationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-templates', organizationId] });
    },
  });
}

export function useUpdatePrintTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: UpdatePrintTemplateData }) =>
      printTemplatesApi.update(organizationId, templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['print-templates', organizationId] });
      queryClient.invalidateQueries({
        queryKey: ['print-templates', organizationId, variables.templateId],
      });
    },
  });
}

export function useDeletePrintTemplate(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      printTemplatesApi.delete(organizationId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-templates', organizationId] });
    },
  });
}
