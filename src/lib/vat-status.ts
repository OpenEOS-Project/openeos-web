/**
 * Steuerstatus (Kleinunternehmer nach § 19 UStG ↔ umsatzsteuerpflichtig):
 * Wechsel mit Cloud-TSE und Hinweis auf die Umsatzgrenzen
 * (Steuerberater 2026-11-10, Fragen 9/10).
 */
import { ApiException } from '@/types/api';
import type { Organization } from '@/types/organization';
import type { SmallBusinessStatus } from '@/types/report';

/** 409 der API, wenn der Steuerstatus nur über einen Kassenabschluss wechseln darf. */
export const VAT_STATUS_CLOSING_REASON = 'VAT_STATUS_CHANGE_REQUIRES_CLOSING';

/**
 * Wechsel nur über `POST …/vat-status` (Kassenabschluss vorher)? Sobald die
 * Organisation eine Cloud-TSE hat oder hatte, gibt es TSE-Vorgänge — dann
 * lehnt die API den einfachen Schalter ab. Ohne TSE bleibt der Schalter;
 * meldet die API trotzdem 409, greift `isVatStatusClosingError`.
 */
export function vatStatusNeedsClosing(
  organization: Pick<Organization, 'tseActive' | 'tse'> | null | undefined,
): boolean {
  if (!organization) return false;
  if (organization.tseActive === true || organization.tse?.active === true) return true;
  const state = organization.tse?.state;
  return state === 'active' || state === 'deactivated';
}

export function isVatStatusClosingError(error: unknown): boolean {
  return error instanceof ApiException && error.reason === VAT_STATUS_CLOSING_REASON;
}

export interface SmallBusinessNotice {
  kind: 'approaching' | 'exceeded';
  /** Welche Grenze: 100.000 € im laufenden oder 25.000 € im Vorjahr. */
  basis: 'current' | 'previous';
  /** Umsatz in OpenEOS (Euro) des maßgeblichen Jahres. */
  revenue: number;
  /** Grenze in Euro. */
  limit: number;
  /** Anteil an der Grenze in Prozent (gerundet). */
  percent: number;
}

/**
 * Hinweis im Dashboard für Kleinunternehmer, `null` ohne Warnung. Bei
 * „überschritten“ zählt zuerst das laufende Jahr, sonst das Vorjahr.
 */
export function smallBusinessNotice(status: SmallBusinessStatus | null | undefined): SmallBusinessNotice | null {
  if (!status || !status.vatExempt || !status.warning) return null;
  const previousExceeded =
    status.warning === 'exceeded' &&
    status.currentYearRevenue <= status.limitCurrentYear &&
    status.previousYearRevenue > status.limitPreviousYear;
  const revenue = previousExceeded ? status.previousYearRevenue : status.currentYearRevenue;
  const limit = previousExceeded ? status.limitPreviousYear : status.limitCurrentYear;
  return {
    kind: status.warning,
    basis: previousExceeded ? 'previous' : 'current',
    revenue,
    limit,
    percent: limit > 0 ? Math.floor((revenue / limit) * 100) : 0,
  };
}
