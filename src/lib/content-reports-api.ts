import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  ContentReport,
  ContentReportStatus,
  CreateContentReportData,
  UpdateContentReportData,
} from '@/types/content-report';

/** „Inhalt melden“ (öffentlich) und die Bearbeitung durch den Super-Admin. */
export const contentReportsApi = {
  submit: (data: CreateContentReportData) =>
    apiClient.post<ApiResponse<{ message: string }>>('/public/content-reports', data, { skipAuth: true }),

  list: (status?: ContentReportStatus) =>
    apiClient.get<ApiResponse<ContentReport[]>>(
      `/admin/content-reports${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),

  update: (id: string, data: UpdateContentReportData) =>
    apiClient.patch<ApiResponse<ContentReport>>(`/admin/content-reports/${id}`, data),

  notify: (id: string, target: 'reporter' | 'organization') =>
    apiClient.post<ApiResponse<ContentReport>>(`/admin/content-reports/${id}/notify`, { target }),
};

/** Adresse des Meldeformulars mit vorbelegter Fundstelle. */
export function reportHref(url: string | null | undefined): string {
  return url ? `/report?url=${encodeURIComponent(url)}` : '/report';
}
