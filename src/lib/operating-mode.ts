/**
 * Betriebsart der Organisation (`operatingMode`, eine Spalte je
 * Organisation, nicht in den Einstellungen):
 *
 * - `orders_only` („Nur Bons“): Bestellen, Küche, Ausgabe, Bons – ohne
 *   Preise und ohne Zahlungen. Kassiert wird außerhalb von OpenEOS.
 * - `cashless` („Bargeldlos“): alle Funktionen mit Karte (SumUp) und
 *   Online-Vorkasse; Bargeld gibt es in OpenEOS nicht.
 * - `full` („Alle Funktionen“): Bargeld, Karte und online. In Deutschland
 *   nur mit aktiver Cloud-TSE wählbar und – außer im Bestand – nur dann
 *   mit Bargeld.
 *
 * Bestandsorganisationen (`operatingModeLegacy`) laufen als `full` ohne TSE
 * weiter, bis sie eine Betriebsart wählen („Alle Funktionen (Bestand)“).
 *
 * Der Server entscheidet und liefert die abgeleiteten Werte (`cashAllowed`,
 * `pricesVisible`, `tseActive`, Optionen) mit; die Berechnung hier ist nur
 * der Rückfall für ältere Antworten und die Grundlage der Tests.
 */
import type { OrderItem } from '@/types/order';

export type OperatingMode = 'orders_only' | 'cashless' | 'full';
/** Werte im Verlauf: `full_legacy` = „Alle Funktionen (Bestand)“. */
export type OperatingModeHistoryValue = OperatingMode | 'full_legacy';
export type OperatingModeUnavailableReason =
  | 'tse_required'
  | 'tse_coming_soon'
  | 'paid_event_required'
  | 'country_required';

/** Reihenfolge in Auswahl und Texten. */
export const OPERATING_MODES: readonly OperatingMode[] = ['orders_only', 'cashless', 'full'];

/** Felder der Organisation, aus denen sich die Betriebsart ergibt. */
export interface OperatingModeOrg {
  country?: string | null;
  operatingMode?: unknown;
  operatingModeLegacy?: boolean | null;
  operatingModeSince?: string | null;
  tseActive?: boolean | null;
  cashAllowed?: boolean | null;
  pricesVisible?: boolean | null;
}

export interface OperatingModeOption {
  mode: OperatingMode;
  available: boolean;
  unavailableReason: OperatingModeUnavailableReason | null;
}

/** Abgeleiteter Zustand, wie ihn Verwaltung und Kasse brauchen. */
export interface OperatingModeView {
  mode: OperatingMode;
  legacy: boolean;
  since: string | null;
  /** Land in Großbuchstaben, `null` = noch nicht hinterlegt. */
  country: string | null;
  tseActive: boolean;
  /** Bargeld an der Kasse (Zahlung, Rückgeld, Kassenlade, Pfand bar). */
  cashAllowed: boolean;
  /** Preise und Beträge anzeigen (alles außer „Nur Bons“). */
  pricesVisible: boolean;
  /** Zahlungen jeder Art (Karte, online, Trinkgeld, Rabatt, Pfand …). */
  paymentsEnabled: boolean;
  ordersOnly: boolean;
  /**
   * „Alle Funktionen“, aber Bargeld gesperrt (Deutschland ohne aktive
   * TSE) — die Kasse zeigt dazu einen Hinweis.
   */
  cashBlockedWithoutTse: boolean;
}

export function isOperatingMode(value: unknown): value is OperatingMode {
  return value === 'orders_only' || value === 'cashless' || value === 'full';
}

/** Ohne gültigen Wert gilt `full` – so verhalten sich alle Bestandsorganisationen. */
export function getOperatingMode(org: OperatingModeOrg | null | undefined): OperatingMode {
  const value = org?.operatingMode;
  return isOperatingMode(value) ? value : 'full';
}

export function normalizedCountry(org: OperatingModeOrg | null | undefined): string | null {
  const country = (org?.country ?? '').trim().toUpperCase();
  return country || null;
}

/** Bargeld erlaubt? Wert der API, sonst dieselbe Regel wie dort. */
export function isCashAllowed(org: OperatingModeOrg | null | undefined): boolean {
  if (!org) return false;
  if (typeof org.cashAllowed === 'boolean') return org.cashAllowed;
  if (getOperatingMode(org) !== 'full') return false;
  return normalizedCountry(org) !== 'DE' || !!org.operatingModeLegacy || !!org.tseActive;
}

/** Preise sichtbar? Wert der API, sonst alles außer „Nur Bons“. */
export function arePricesVisible(org: OperatingModeOrg | null | undefined): boolean {
  if (typeof org?.pricesVisible === 'boolean') return org.pricesVisible;
  return getOperatingMode(org) !== 'orders_only';
}

export function isOrdersOnly(org: OperatingModeOrg | null | undefined): boolean {
  return getOperatingMode(org) === 'orders_only';
}

export function resolveOperatingMode(org: OperatingModeOrg | null | undefined): OperatingModeView {
  const mode = getOperatingMode(org);
  const cashAllowed = isCashAllowed(org);
  return {
    mode,
    legacy: !!org?.operatingModeLegacy,
    since: org?.operatingModeSince ?? null,
    country: normalizedCountry(org),
    tseActive: !!org?.tseActive,
    cashAllowed,
    pricesVisible: arePricesVisible(org),
    paymentsEnabled: mode !== 'orders_only',
    ordersOnly: mode === 'orders_only',
    cashBlockedWithoutTse: !!org && mode === 'full' && !cashAllowed,
  };
}

/**
 * Wählbarkeit einer Betriebsart (Rückfall, wenn die API keine `options`
 * liefert): ohne Land keine; `full` in Deutschland nur mit aktiver TSE.
 */
export function operatingModeOption(org: OperatingModeOrg | null | undefined, mode: OperatingMode): OperatingModeOption {
  const country = normalizedCountry(org);
  if (!country) return { mode, available: false, unavailableReason: 'country_required' };
  if (mode === 'full' && country === 'DE' && !org?.tseActive) {
    return { mode, available: false, unavailableReason: 'tse_required' };
  }
  return { mode, available: true, unavailableReason: null };
}

/** Optionen der API in fester Reihenfolge, fehlende aus der Regel ergänzt. */
export function operatingModeOptions(
  org: OperatingModeOrg | null | undefined,
  fromApi?: OperatingModeOption[] | null,
): OperatingModeOption[] {
  return OPERATING_MODES.map((mode) => fromApi?.find((o) => o.mode === mode) ?? operatingModeOption(org, mode));
}

/**
 * Kann auf `target` gewechselt werden? Dieselbe Betriebsart noch einmal
 * gibt es nur im Bestand (`full` bestätigen, außerhalb Deutschlands): das
 * beendet den Bestand-Status.
 */
export function canSwitchTo(
  org: OperatingModeOrg | null | undefined,
  target: OperatingMode,
  options?: OperatingModeOption[] | null,
): boolean {
  const option = operatingModeOptions(org, options).find((o) => o.mode === target);
  if (!option?.available) return false;
  if (target !== getOperatingMode(org)) return true;
  return !!org?.operatingModeLegacy;
}

/**
 * Gibt es nach dem Wechsel keinen Weg zurück zu „Alle Funktionen“? In
 * Deutschland ohne TSE nicht (und der Bestand ist weg) — die Rückfrage
 * verlangt dann eine ausdrückliche Bestätigung.
 */
export function switchIsOneWay(org: OperatingModeOrg | null | undefined, target: OperatingMode): boolean {
  return (
    normalizedCountry(org) === 'DE' && !org?.tseActive && getOperatingMode(org) === 'full' && target !== 'full'
  );
}

/** Herstellerbescheinigung: Deutschland in „Nur Bons“ oder „Bargeldlos“. */
export function certificateAvailable(org: OperatingModeOrg | null | undefined): boolean {
  return normalizedCountry(org) === 'DE' && getOperatingMode(org) !== 'full';
}

/** Anzeigewert (wie im Verlauf): der Bestand hat einen eigenen Namen. */
export function operatingModeLabelValue(org: OperatingModeOrg | null | undefined): OperatingModeHistoryValue {
  const mode = getOperatingMode(org);
  return mode === 'full' && org?.operatingModeLegacy ? 'full_legacy' : mode;
}

/* ── Hinweise ──────────────────────────────────────────────────────── */

/**
 * Hinweis zum Bestand:
 * - `de`: Bestand in Deutschland oder ohne Land → deutlicher Hinweis auf
 *   die TSE-Pflicht mit der Bitte um Land und Betriebsart (Dashboard und
 *   Einstellungen),
 * - `confirm`: Bestand außerhalb Deutschlands → sanfte Bitte, die
 *   Betriebsart zu bestätigen (nur in den Einstellungen),
 * - `null`: kein Bestand.
 */
export type LegacyNoticeKind = 'de' | 'confirm';

export function legacyNoticeKind(org: OperatingModeOrg | null | undefined): LegacyNoticeKind | null {
  if (!org?.operatingModeLegacy || getOperatingMode(org) !== 'full') return null;
  const country = normalizedCountry(org);
  return !country || country === 'DE' ? 'de' : 'confirm';
}

/** Länderhinweis in der Karte „Betriebsart“ (immer „keine Steuerberatung“). */
export type CountryNoticeKind = 'de' | 'at' | 'ch' | 'other';

export function countryNoticeKind(org: OperatingModeOrg | null | undefined): CountryNoticeKind | null {
  const country = normalizedCountry(org);
  if (!country) return null;
  if (country === 'DE') return 'de';
  if (country === 'AT') return 'at';
  if (country === 'CH') return 'ch';
  return 'other';
}

/**
 * Hinweis im Dashboard: zuerst die Bitte um das Land, dann der Bestand in
 * Deutschland. Länderhinweise stehen nur in den Einstellungen.
 */
export type DashboardNoticeKind = 'set_country' | 'legacy_de';

export function dashboardNoticeKind(org: OperatingModeOrg | null | undefined): DashboardNoticeKind | null {
  if (!org) return null;
  if (!normalizedCountry(org)) return 'set_country';
  return legacyNoticeKind(org) === 'de' ? 'legacy_de' : null;
}

/* ── Links ─────────────────────────────────────────────────────────── */

/** Doku-Seite „Betriebsarten“ je Sprache. */
export function operatingModeDocsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en/betriebsarten' : 'https://docs.openeos.de/betriebsarten';
}

/** FAQ-Eintrag zu Bargeld und TSE auf openeos.de. */
export function tseFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#tse' : 'https://openeos.de/faq#tse';
}

/** FAQ-Eintrag „Gilt das auch in Österreich und der Schweiz?“. */
export function countriesFaqUrl(locale: string): string {
  return locale === 'en' ? 'https://openeos.de/en/faq#laender' : 'https://openeos.de/faq#laender';
}

/** Offizielle Quelle zur Registrierkassenpflicht in Österreich (USP). */
export const AT_RKSV_URL =
  'https://www.usp.gv.at/themen/steuern-finanzen/steuerliche-rechte-und-pflichten/registrierkassen/registrierkassenpflicht.html';

/** Einstellungen → Organisation → Betriebsart. */
export const OPERATING_MODE_SETTINGS_HREF = '/settings?tab=org-mode';

/* ── Super-Admin ───────────────────────────────────────────────────── */

/** Grund beim Umschalten durch den Support: mindestens 5 Zeichen, wie die API. */
export const OPERATING_MODE_REASON_MIN = 5;
export const OPERATING_MODE_REASON_MAX = 500;

export function reasonError(reason: string): 'reasonTooShort' | 'reasonTooLong' | null {
  const trimmed = reason.trim();
  if (trimmed.length < OPERATING_MODE_REASON_MIN) return 'reasonTooShort';
  if (trimmed.length > OPERATING_MODE_REASON_MAX) return 'reasonTooLong';
  return null;
}

/** Prüfung im Support-Dialog: andere (wählbare) Betriebsart und ein Grund. */
export function operatingModeSwitchError(
  org: OperatingModeOrg | null | undefined,
  next: OperatingMode,
  reason: string,
  options?: OperatingModeOption[] | null,
): 'unchanged' | 'unavailable' | 'reasonTooShort' | 'reasonTooLong' | null {
  if (next === getOperatingMode(org) && !org?.operatingModeLegacy) return 'unchanged';
  if (!canSwitchTo(org, next, options)) return 'unavailable';
  return reasonError(reason);
}

/* ── Kasse ─────────────────────────────────────────────────────────── */

/**
 * Kassiermodus der Kasse. In „Nur Bons“ immer `tab`: die Bestellung wird
 * gesendet, nie kassiert.
 */
export function effectiveOrderingMode(
  orderingMode: 'immediate' | 'tab' | undefined | null,
  ordersOnly: boolean,
): 'immediate' | 'tab' {
  if (ordersOnly) return 'tab';
  return orderingMode === 'tab' ? 'tab' : 'immediate';
}

type ItemLike = Pick<OrderItem, 'status' | 'quantity'> & { productionStationId?: string | null };

/** Positionen, an denen eine Station noch arbeitet (wie die API). */
export function itemsInProduction<T extends ItemLike>(items: T[] | undefined): T[] {
  return (items ?? []).filter(
    (item) =>
      item.status !== 'cancelled' &&
      !!item.productionStationId &&
      (item.status === 'pending' || item.status === 'preparing'),
  );
}

/**
 * „Abgeholt“ (Nur Bons): Lässt sich eine offene Bestellung abschließen?
 * Nicht, solange eine Station noch daran arbeitet — die API antwortet dann
 * mit 400 ORDER_ITEMS_IN_PRODUCTION.
 */
export function canCompleteOrder(order: { status: string; items?: ItemLike[] }): boolean {
  if (order.status === 'completed' || order.status === 'cancelled') return false;
  return itemsInProduction(order.items).length === 0;
}

/**
 * „Tisch abschließen“ (Nur Bons): alle offenen Bestellungen des Tisches.
 * Gesperrt, solange etwas in Zubereitung ist; `blocked` zählt die
 * betroffenen Positionen für den Hinweis.
 */
export function tableCloseState(orders: { id: string; status: string; items?: ItemLike[] }[]): {
  orderIds: string[];
  canClose: boolean;
  blocked: number;
} {
  const open = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const blocked = open.reduce((sum, o) => sum + itemsInProduction(o.items).reduce((n, i) => n + i.quantity, 0), 0);
  return { orderIds: open.map((o) => o.id), canClose: open.length > 0 && blocked === 0, blocked };
}

/* ── Kundenanzeige ─────────────────────────────────────────────────── */

type CartLike = {
  items: { unitPrice: number; lineTotal: number; pfandAmount: number }[];
  totals: { subtotal: number; discount: number; pfand: number; payable: number };
  vouchers: { name: string; amount: number }[];
  hidePrices?: boolean;
};

/**
 * Warenkorb für die Kundenanzeige in „Nur Bons“: Positionen und Mengen
 * bleiben, jeder Betrag wird 0 und `hidePrices` gesetzt. Die Kasse sendet
 * so gar keine Preise; die Anzeige blendet Beträge ohnehin aus.
 */
export function stripCartPrices<T extends CartLike>(cart: T): T {
  return {
    ...cart,
    items: cart.items.map((item) => ({ ...item, unitPrice: 0, lineTotal: 0, pfandAmount: 0 })),
    totals: { subtotal: 0, discount: 0, pfand: 0, payable: 0 },
    vouchers: cart.vouchers.map((v) => ({ ...v, amount: 0 })),
    hidePrices: true,
  };
}

/**
 * Zeigt die Kundenanzeige Beträge? Nicht, wenn die Organisation keine
 * Preise zeigt („Nur Bons“) oder die Kasse den Warenkorb ohne Preise schickt.
 */
export function customerDisplayShowsPrices(
  org: OperatingModeOrg | null | undefined,
  cart: { hidePrices?: boolean } | null | undefined,
): boolean {
  return arePricesVisible(org) && !cart?.hidePrices;
}

/* ── Auswertung und Dashboard ──────────────────────────────────────── */

/**
 * Rangfolge der Produkte/Kategorien. In „Nur Bons“ gibt es keinen Umsatz —
 * dort zählt die Menge, sonst der Umsatz.
 */
export function rankByMode<T>(
  rows: T[],
  ordersOnly: boolean,
  quantity: (row: T) => number,
  amount: (row: T) => number,
): T[] {
  return [...rows].sort((a, b) =>
    ordersOnly ? quantity(b) - quantity(a) || amount(b) - amount(a) : amount(b) - amount(a),
  );
}
