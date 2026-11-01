/**
 * Betriebsmodus der Organisation (`settings.operatingMode`).
 *
 * - `pos` (Standard): Kasse mit Zahlung, Erstattung, Kassenlade, Pfand.
 * - `order_only` („Nur Bestellen“): OpenEOS nimmt Bestellungen auf und
 *   steuert Küche, Stationen und Ausgabe, kennt aber kein Kassenmodul.
 *   Kassiert wird außerhalb von OpenEOS (offene Ladenkasse).
 *
 * Umschalten kann nur der OpenEOS-Support (Super-Admin); die API sperrt im
 * Modus `order_only` jede Zahlung mit 403 `ORDER_ONLY_MODE`. Die Oberfläche
 * blendet deshalb alles aus, was mit Bezahlen zu tun hat.
 */
import type { OrderItem } from '@/types/order';

export type OperatingMode = 'pos' | 'order_only';

/** Nur ein ausdrückliches `order_only` zählt — wie in der API. */
export function getOperatingMode(settings: { operatingMode?: unknown } | null | undefined): OperatingMode {
  return settings?.operatingMode === 'order_only' ? 'order_only' : 'pos';
}

export function isOrderOnlyMode(settings: { operatingMode?: unknown } | null | undefined): boolean {
  return getOperatingMode(settings) === 'order_only';
}

/**
 * Kassiermodus der Kasse. Im Modus „Nur Bestellen“ immer `tab`: die
 * Bestellung wird gesendet, nie kassiert.
 */
export function effectiveOrderingMode(
  orderingMode: 'immediate' | 'tab' | undefined | null,
  orderOnly: boolean,
): 'immediate' | 'tab' {
  if (orderOnly) return 'tab';
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
 * Lässt sich eine offene Bestellung ohne Zahlung abschließen?
 * Nicht, solange eine Station noch daran arbeitet — die API antwortet dann
 * mit 400 ORDER_ITEMS_IN_PRODUCTION.
 */
export function canCompleteOrder(order: { status: string; items?: ItemLike[] }): boolean {
  if (order.status === 'completed' || order.status === 'cancelled') return false;
  return itemsInProduction(order.items).length === 0;
}

/**
 * „Tisch abschließen“: alle offenen Bestellungen des Tisches. Gesperrt,
 * solange etwas in Zubereitung ist; `blocked` zählt die betroffenen
 * Positionen für den Hinweis.
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

/** Doku-Seite „Nur Bestellen (ohne Kasse)“ je Sprache. */
export function orderOnlyDocsUrl(locale: string): string {
  return locale === 'en' ? 'https://docs.openeos.de/en/nur-bestellen' : 'https://docs.openeos.de/nur-bestellen';
}

/** Grund beim Umschalten (Super-Admin): mindestens 5 Zeichen, wie die API. */
export const OPERATING_MODE_REASON_MIN = 5;
export const OPERATING_MODE_REASON_MAX = 500;

export function operatingModeSwitchError(
  current: OperatingMode,
  next: OperatingMode,
  reason: string,
): 'unchanged' | 'reasonTooShort' | 'reasonTooLong' | null {
  if (current === next) return 'unchanged';
  const trimmed = reason.trim();
  if (trimmed.length < OPERATING_MODE_REASON_MIN) return 'reasonTooShort';
  if (trimmed.length > OPERATING_MODE_REASON_MAX) return 'reasonTooLong';
  return null;
}
