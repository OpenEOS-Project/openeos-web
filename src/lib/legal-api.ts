import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { ElsterInfo, LegalAcceptData, LegalStatus, LegalVersions } from '@/types/legal';

/**
 * Rechtstexte von OpenEOS und deren Annahme (siehe types/legal.ts).
 *
 * Eigene Datei statt eines weiteren Blocks in api-client.ts — wie
 * tables-api.ts.
 */
export const legalApi = {
  /** Öffentlich: gültige Fassungen und Adressen der Rechtstexte. */
  versions: () => apiClient.get<ApiResponse<LegalVersions>>('/legal/versions', { skipAuth: true }),

  /** Was der angemeldete Benutzer angenommen hat. */
  status: () => apiClient.get<ApiResponse<LegalStatus>>('/legal/status'),

  /** AGB und AVV annehmen (ohne Angabe beide). */
  accept: (data: LegalAcceptData) => apiClient.post<ApiResponse<LegalStatus>>('/legal/accept', data),

  /** Angaben für die Mitteilung der Kasse ans Finanzamt (Org-Admins). */
  elster: (organizationId: string) =>
    apiClient.get<ApiResponse<ElsterInfo>>(`/organizations/${organizationId}/legal/elster`),
};
