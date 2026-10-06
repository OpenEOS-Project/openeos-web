/**
 * "Letzte Aktivitaeten" auf dem Dashboard.
 *
 * Die Liste zeigte bei jeder Bestellung "0 Artikel": die API liefert die
 * Positionen nur mit `includeItems=true`, das Dashboard fragte ohne an und
 * zaehlte dann ein fehlendes `items` als null Positionen.
 */

import type { Order, QueryOrdersParams } from '@/types/order';
import type { DayKey } from '@/utils/calendar-date';

/** So viele Bestellungen zeigt die Liste. */
export const RECENT_ORDERS_LIMIT = 10;

/** Abfrage fuer die Bestellungen eines Tages, neueste zuerst, mit Positionen. */
export function recentOrdersQuery(day: DayKey): QueryOrdersParams {
  return {
    dateFrom: day,
    dateTo: day,
    includeItems: true,
    page: 1,
    limit: RECENT_ORDERS_LIMIT,
  };
}

/**
 * Artikel einer Bestellung: Summe der Mengen ("2x Bier, 1x Wurst" sind
 * 3 Artikel). null, wenn die Positionen nicht mitgeladen wurden — dann
 * ist die Zahl unbekannt und nicht 0.
 */
export function countOrderItems(order: Pick<Order, 'items'>): number | null {
  if (!Array.isArray(order.items)) return null;
  return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}
