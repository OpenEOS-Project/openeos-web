/**
 * Bargeld-Regel je Land (wie die API, src/common/utils/cash-policy.util.ts).
 *
 * - Neue Organisationen in Deutschland: Bargeld ist gesperrt, solange
 *   OpenEOS keine TSE anbindet (`blocked_de_no_tse`). Kein Schalter für den
 *   Verein; bar außerhalb kassierte Bestellungen schließt die Kasse mit
 *   „Ohne Zahlung abschließen“ ab.
 * - Bestandsorganisationen (`cashPolicyLegacy`) verhalten sich wie bisher,
 *   bis ein Admin freiwillig wechselt (nur in eine Richtung).
 * - Österreich, Schweiz und alle anderen Länder: wie bisher.
 * - „Nur Bestellen“ gewinnt immer (keine Zahlungen in OpenEOS).
 *
 * Die API liefert `cashPolicy` mit jeder Organisation; die Berechnung hier
 * ist nur der Rückfall für ältere Antworten.
 */
import { isCashlessMode } from './cashless';
import { isOrderOnlyMode } from './operating-mode';

export type CashPolicy = 'allowed' | 'blocked_de_no_tse';
export type CashPolicyReason = 'legacy' | 'de_no_tse' | 'de_tse' | 'country' | 'no_country';

export interface CashPolicyOrg {
  country?: string | null;
  cashPolicy?: CashPolicy;
  cashPolicyLegacy?: boolean;
  cashPolicyReason?: CashPolicyReason;
  settings?: { payments?: { cashless?: boolean }; operatingMode?: unknown } | null;
}

/** Wirksame Regel: von der API, sonst aus Land und Bestandsschutz. */
export function effectiveCashPolicy(org: CashPolicyOrg | null | undefined): CashPolicy {
  if (!org) return 'allowed';
  if (org.cashPolicy) return org.cashPolicy;
  if (org.cashPolicyLegacy) return 'allowed';
  return (org.country ?? '').toUpperCase() === 'DE' ? 'blocked_de_no_tse' : 'allowed';
}

/** „Deutschland ohne Bargeld“: Bargeld durch die Landesregel gesperrt. */
export function isCashBlockedByPolicy(org: CashPolicyOrg | null | undefined): boolean {
  return effectiveCashPolicy(org) === 'blocked_de_no_tse';
}

/** Bargeld nicht verfügbar — Landesregel oder bargeldloser Schalter. */
export function isCashBlocked(org: CashPolicyOrg | null | undefined): boolean {
  return isCashBlockedByPolicy(org) || isCashlessMode(org?.settings);
}

/**
 * Welcher Hinweis gehört zu dieser Organisation?
 *
 * - `set_country`: kein Land hinterlegt (Bestand) → einmal festlegen.
 * - `de_legacy`: Bestand in Deutschland → TSE-Pflicht, drei Wege.
 * - `de_blocked`: „Deutschland ohne Bargeld“ → Erklärung, Bescheinigung.
 * - `at`, `ch`, `other`: Länderhinweis.
 * - `null`: nichts (z. B. Deutschland mit aktiver TSE).
 *
 * Im Modus „Nur Bestellen“ gibt es keine Kasse in OpenEOS — dann nur die
 * Bitte um das Land.
 */
export type CashNoticeKind = 'set_country' | 'de_legacy' | 'de_blocked' | 'at' | 'ch' | 'other';

export function cashNoticeKind(org: CashPolicyOrg | null | undefined): CashNoticeKind | null {
  if (!org) return null;
  const country = (org.country ?? '').toUpperCase();
  if (!country) return 'set_country';
  if (isOrderOnlyMode(org.settings ?? undefined)) return null;
  if (country === 'DE') {
    if (org.cashPolicyLegacy) return 'de_legacy';
    return isCashBlockedByPolicy(org) ? 'de_blocked' : null;
  }
  if (country === 'AT') return 'at';
  if (country === 'CH') return 'ch';
  return 'other';
}

/** Kann der Admin auf „Deutschland ohne Bargeld“ wechseln? (Bestand + DE) */
export function canSwitchToCountryPolicy(org: CashPolicyOrg | null | undefined): boolean {
  return !!org?.cashPolicyLegacy && (org.country ?? '').toUpperCase() === 'DE';
}

/** Zeigt die Kasse „Ohne Zahlung abschließen“? Nicht in „Nur Bestellen“. */
export function offersCloseWithoutPayment(org: CashPolicyOrg | null | undefined): boolean {
  return isCashBlockedByPolicy(org) && !isOrderOnlyMode(org?.settings ?? undefined);
}

/** localStorage-Schlüssel: Hinweis im Dashboard weggeklickt (je Nutzer, Organisation, Art). */
export function cashNoticeStorageKey(userId: string, organizationId: string, kind: CashNoticeKind): string {
  return `openeos-cash-notice-dismissed:${userId}:${organizationId}:${kind}`;
}

/** Doku-Seite „Land und Bargeld“ je Sprache. */
export function cashPolicyDocsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en/land-und-bargeld' : 'https://docs.openeos.de/land-und-bargeld';
}

/** FAQ-Eintrag „Gilt das auch in Österreich und der Schweiz?“. */
export function countriesFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#laender' : 'https://openeos.de/faq#laender';
}

/** Offizielle Quelle zur Registrierkassenpflicht in Österreich (USP). */
export const AT_RKSV_URL =
  'https://www.usp.gv.at/themen/steuern-finanzen/steuerliche-rechte-und-pflichten/registrierkassen/registrierkassenpflicht.html';
