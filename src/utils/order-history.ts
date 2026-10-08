import type { IconName } from '@openeos/ui';
import type { BadgeTone } from '@openeos/ui';

import type { OrderItemStatus } from '@/types/order';
import type { OrderDisplayStatus, OrderHistoryRow } from '@/types/order-history';
import type { PaymentMethod } from '@/types/payment';

/**
 * Darstellung des Bestellverlaufs — gemeinsam für Kasse und Verwaltung:
 * ein Status je Bestellung (Ton + Icon), Zahlart-Icons, Ort, Kurzinhalt
 * und Gruppierung nach Tag. Nur Lucide-Icons, keine Zeichen als Icons.
 */

export const DISPLAY_STATUS_TONE: Record<OrderDisplayStatus, BadgeTone> = {
  in_kitchen: 'info',
  ready: 'success',
  completed: 'outline',
  unpaid: 'warn',
  cancelled: 'danger',
  partly_refunded: 'warn',
  refunded: 'ink',
};

export const DISPLAY_STATUS_ICON: Record<OrderDisplayStatus, IconName> = {
  in_kitchen: 'chef',
  ready: 'check-circle',
  completed: 'check',
  unpaid: 'clock',
  cancelled: 'ban',
  partly_refunded: 'undo',
  refunded: 'undo',
};

/** Status-Chips im Filter: „Erstattet“ fasst teilweise und ganz erstattet zusammen. */
export const STATUS_FILTERS: { id: string; statuses: OrderDisplayStatus[] }[] = [
  { id: 'in_kitchen', statuses: ['in_kitchen'] },
  { id: 'ready', statuses: ['ready'] },
  { id: 'unpaid', statuses: ['unpaid'] },
  { id: 'completed', statuses: ['completed'] },
  { id: 'cancelled', statuses: ['cancelled'] },
  { id: 'refunded', statuses: ['partly_refunded', 'refunded'] },
];

export const ITEM_STATUS_TONE: Record<OrderItemStatus, BadgeTone> = {
  pending: 'outline',
  preparing: 'info',
  ready: 'success',
  delivered: 'ink',
  cancelled: 'danger',
};

export function paymentIcon(method: PaymentMethod | string): IconName {
  if (method === 'cash') return 'cash';
  if (method === 'sumup_terminal' || method === 'sumup_online') return 'contactless';
  return 'card';
}

/** Zahlart-Schlüssel für Texte (cash, card, sumup). */
export function paymentKey(method: PaymentMethod | string): 'cash' | 'card' | 'sumup' {
  if (method === 'cash') return 'cash';
  if (method === 'sumup_terminal' || method === 'sumup_online') return 'sumup';
  return 'card';
}

/**
 * Zahlart-Icons einer Zeile (ohne Doppelte). Rabatt-Bons erscheinen als
 * eigenes Icon, auch wenn sie die ganze Summe decken (dann gibt es keine
 * Zahlung).
 */
export function paymentBadges(
  row: Pick<OrderHistoryRow, 'paymentMethods' | 'discountAmount'>
): { key: 'cash' | 'card' | 'sumup' | 'discount'; icon: IconName }[] {
  const out: { key: 'cash' | 'card' | 'sumup' | 'discount'; icon: IconName }[] = [];
  for (const method of row.paymentMethods ?? []) {
    const key = paymentKey(method);
    if (!out.some((b) => b.key === key)) out.push({ key, icon: paymentIcon(method) });
  }
  if (Number(row.discountAmount) > 0) out.push({ key: 'discount', icon: 'percent' });
  return out;
}

export type OrderPlace = 'table' | 'counter' | 'togo';

export function orderPlace(
  row: Pick<OrderHistoryRow, 'tableNumber' | 'source' | 'fulfillmentType'>
): OrderPlace {
  if (row.tableNumber) return 'table';
  if (row.source === 'online' || row.source === 'qr_order') return 'togo';
  return 'counter';
}

/**
 * Kurzinhalt „3x Burger, 2x Pils“ (stornierte Positionen zählen nicht,
 * gleiche Produkte zusammengefasst). Mehr als `max` Produkte: der Rest
 * als Zahl (`more`), die Darstellung entscheidet über den Text.
 */
export function itemsSummary(
  items: { productName: string; quantity: number; status: string }[],
  max = 3
): { parts: string[]; more: number } {
  const byName = new Map<string, number>();
  for (const item of items) {
    if (item.status === 'cancelled') continue;
    byName.set(item.productName, (byName.get(item.productName) ?? 0) + item.quantity);
  }
  const all = [...byName.entries()].map(([name, qty]) => `${qty}x ${name}`);
  return { parts: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/** Lokaler Tag als Schlüssel (YYYY-MM-DD). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DayGroup<T> {
  key: string;
  /** `today`, `yesterday` oder `date` (dann `date` formatieren). */
  kind: 'today' | 'yesterday' | 'date';
  date: Date;
  rows: T[];
}

/** Gruppiert nach lokalem Tag (Reihenfolge der Eingabe bleibt). */
export function groupByDay<T extends { createdAt: string }>(
  rows: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const groups: DayGroup<T>[] = [];
  for (const row of rows) {
    const date = new Date(row.createdAt);
    const key = dayKey(date);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {
        key,
        kind: key === today ? 'today' : key === yesterday ? 'yesterday' : 'date',
        date,
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** Beginn des lokalen Tages als ISO-Zeitpunkt (Filter „Heute“). */
export function startOfLocalDay(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Positionen, die noch storniert werden können (aktiv, nicht erstattet). */
export function cancellableQuantity(item: {
  status: string;
  quantity: number;
  refundedQuantity?: number;
}): number {
  if (item.status === 'cancelled') return 0;
  return Math.max(0, item.quantity - (item.refundedQuantity ?? 0));
}

/** Hat die Küche mit der Position schon begonnen (in Arbeit, fertig, serviert)? */
export function isStarted(status: string): boolean {
  return status === 'preparing' || status === 'ready' || status === 'delivered';
}

export const round2 = (value: number) => Math.round(value * 100) / 100;
