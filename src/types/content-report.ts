/**
 * Meldungen über „Inhalt melden“ (Melde- und Abhilfeverfahren nach
 * Art. 16 DSA) und ihre Bearbeitung durch die Plattform-Verwaltung
 * (Begründung nach Art. 17 DSA).
 */

export const CONTENT_REPORT_REASONS = [
  'illegal',
  'intellectual_property',
  'personal_rights',
  'consumer_protection',
  'youth_protection',
  'fraud',
  'other',
] as const;
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];

export const CONTENT_REPORT_STATUSES = ['open', 'in_review', 'closed'] as const;
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];

export const CONTENT_REPORT_ACTIONS = ['none', 'hide_content', 'disable_shop'] as const;
export type ContentReportAction = (typeof CONTENT_REPORT_ACTIONS)[number];

export interface CreateContentReportData {
  url: string;
  reason: ContentReportReason;
  description: string;
  name: string;
  email: string;
  goodFaith: boolean;
  /** Honeypot — bleibt leer. */
  website?: string;
  /** Zeitpunkt, zu dem das Formular geladen wurde (ms). */
  startedAt: number;
}

export interface ContentReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  reason: ContentReportReason;
  description: string;
  reporterName: string;
  reporterEmail: string;
  goodFaith: boolean;
  targetType: 'shop' | 'helper_page' | 'unknown';
  organizationId: string | null;
  organizationName: string | null;
  eventId: string | null;
  eventName: string | null;
  shiftPlanId: string | null;
  shiftPlanName: string | null;
  status: ContentReportStatus;
  action: ContentReportAction | null;
  decision: string | null;
  facts: string | null;
  ground: string | null;
  redress: string | null;
  /** Was eine Mitteilung als Rechtsbehelf nennt (eigener Text oder Standard). */
  effectiveRedress: string;
  actionAppliedAt: string | null;
  receiptSentAt: string | null;
  adminNotifiedAt: string | null;
  reporterNotifiedAt: string | null;
  organizationNotifiedAt: string | null;
  closedAt: string | null;
}

export interface UpdateContentReportData {
  status?: ContentReportStatus;
  action?: ContentReportAction;
  decision?: string;
  facts?: string;
  ground?: string;
  redress?: string;
}
