import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  ElsterInfo,
  LegalAcceptData,
  LegalAnnouncement,
  LegalAnnouncementInput,
  LegalAnnouncementOverview,
  LegalAnnouncementPreview,
  LegalStatus,
  LegalVersions,
  UpcomingLegalChange,
} from '@/types/legal';

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

  /** Angekündigte, noch nicht geltende Fassungen (nur für Admins befüllt). */
  announcements: () => apiClient.get<ApiResponse<UpcomingLegalChange[]>>('/legal/announcements'),

  /** Hinweis auf eine Ankündigung für mich ausblenden. */
  dismissAnnouncement: (id: string) => apiClient.post<void>(`/legal/announcements/${id}/dismiss`),

  /** Super-Admin: Stand, Fassungen und alle Ankündigungen mit Versand. */
  adminOverview: () => apiClient.get<ApiResponse<LegalAnnouncementOverview>>('/admin/legal-announcements'),

  /** Super-Admin: prüfen und Mail rendern, ohne zu speichern. */
  adminPreview: (data: LegalAnnouncementInput) =>
    apiClient.post<ApiResponse<LegalAnnouncementPreview>>('/admin/legal-announcements/preview', data),

  /** Super-Admin: ankündigen und Mails verschicken. */
  adminCreate: (data: LegalAnnouncementInput) =>
    apiClient.post<ApiResponse<LegalAnnouncement>>('/admin/legal-announcements', data),

  /** Super-Admin: gescheiterte Mails erneut einreihen. */
  adminRetry: (id: string) =>
    apiClient.post<ApiResponse<{ queued: number }>>(`/admin/legal-announcements/${id}/retry`),

  /** Angaben für die Mitteilung der Kasse ans Finanzamt (Org-Admins). */
  elster: (organizationId: string) =>
    apiClient.get<ApiResponse<ElsterInfo>>(`/organizations/${organizationId}/legal/elster`),
};
