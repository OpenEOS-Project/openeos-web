import { cartItemCount, cartPayable, type ParkedCart } from '@/stores/cart-store';
import type { Order } from '@/types/order';
import type {
  DeviceDiningTable,
  DeviceTableArea,
  DeviceTableStatus,
  PosTableContext,
  TableMode,
  TableWaitReason,
} from '@/types/table';
import { toTableKey } from '@/types/table';

/** Wirksamer Tischmodus eines Events (fehlt → `free`, wie die API). */
export function effectiveTableMode(settings: { mode?: string } | null | undefined): TableMode {
  const mode = settings?.mode;
  return mode === 'none' || mode === 'predefined' ? mode : 'free';
}

/** Kurzer Schlüssel eines Kontexts: `table:A03`, `counter`, `togo`. */
export function contextId(context: PosTableContext): string {
  return context.kind === 'table' ? `table:${context.key}` : context.kind;
}

export function sameContext(a: PosTableContext | null, b: PosTableContext | null): boolean {
  if (!a || !b) return a === b;
  return contextId(a) === contextId(b);
}

/** Bereiche in Verwaltungsreihenfolge, der Standardbereich des Geräts zuerst. */
export function sortAreas(areas: DeviceTableArea[], deviceAreaId?: string | null): DeviceTableArea[] {
  return [...areas].sort((a, b) => {
    if (deviceAreaId) {
      if (a.id === deviceAreaId && b.id !== deviceAreaId) return -1;
      if (b.id === deviceAreaId && a.id !== deviceAreaId) return 1;
    }
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export interface TableMatch {
  table: DeviceDiningTable;
  area: DeviceTableArea;
  exact: boolean;
}

/** Ziffern einer Bezeichnung ohne führende Nullen („A03“ → „3“). */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/**
 * Treffer für eine Nummerneingabe (Modus `predefined`, Spezifikation
 * §5.2.1): Bezeichnung exakt (groß/klein egal) oder Ziffernanteil ohne
 * führende Nullen gleich der Eingabe — „3“ trifft „A03“, „B03“ und „3“.
 * Exakte Treffer zuerst, dann der Standardbereich, dann wie verwaltet.
 */
export function matchTables(input: string, areas: DeviceTableArea[]): TableMatch[] {
  const key = toTableKey(input);
  if (!key) return [];
  const numeric = /^\d+$/.test(key) ? digitsOf(key) : null;
  const out: TableMatch[] = [];
  areas.forEach((area) => {
    for (const table of area.tables) {
      const label = toTableKey(table.label);
      const exact = label === key;
      const byDigits = numeric !== null && /\d/.test(label) && digitsOf(label) === numeric;
      if (exact || byDigits) out.push({ table, area, exact });
    }
  });
  return out.sort((a, b) => Number(b.exact) - Number(a.exact));
}

/**
 * Hat der Bereich einen gestalteten Tischplan? Ohne Layout liegen alle
 * Tische auf 0/0 (Serie ohne Anordnung) — dann gibt es keine Karte.
 */
export function hasFloorLayout(area: DeviceTableArea): boolean {
  return area.tables.length > 0 && area.tables.some((table) => table.x !== 0 || table.y !== 0);
}

/**
 * Startansicht ohne gemerkte Wahl (F7): die Karte, wenn der Standardbereich
 * des Geräts einen Tischplan hat, sonst die Nummer.
 */
export function defaultStartView(areas: DeviceTableArea[], deviceAreaId: string | null): 'map' | 'number' {
  const area = deviceAreaId ? areas.find((a) => a.id === deviceAreaId) : undefined;
  return area && hasFloorLayout(area) ? 'map' : 'number';
}

export function tableContext(table: DeviceDiningTable): PosTableContext {
  return { kind: 'table', key: toTableKey(table.label), label: table.label, tableId: table.id, areaId: table.areaId };
}

/** Ein Eintrag in „Offene Tische“: Serverstatus und/oder lokaler Parkplatz. */
export interface OpenTableEntry {
  id: string;
  context: PosTableContext;
  state: 'busy' | 'wait';
  /** Grund für `wait` laut Server (Gastbestellung bzw. fertig zum Servieren). */
  waitReason: TableWaitReason | null;
  /** Offener Betrag laut Server plus ungesendeter Warenkorb. */
  amount: number;
  serverAmount: number;
  orderCount: number;
  localItems: number;
  waitingSince: string | null;
  lastActivity: number;
}

/**
 * Führt Serverstatus (`tables/status`) und lokal geparkte Warenkörbe des
 * Events zusammen. Sortierung: wartend zuerst (älteste zuerst), dann
 * zuletzt aktiv.
 */
export function mergeOpenTables(
  status: DeviceTableStatus[],
  parked: Record<string, ParkedCart>,
  eventId: string | null,
  chargePfand: boolean,
): OpenTableEntry[] {
  const byId = new Map<string, OpenTableEntry>();
  for (const s of status) {
    const context: PosTableContext = {
      kind: 'table',
      key: s.key,
      label: s.label,
      ...(s.tableId ? { tableId: s.tableId } : {}),
      ...(s.areaId ? { areaId: s.areaId } : {}),
    };
    const id = contextId(context);
    byId.set(id, {
      id,
      context,
      state: s.status,
      waitReason: s.status === 'wait' ? (s.waitReason ?? null) : null,
      amount: Number(s.openAmount) || 0,
      serverAmount: Number(s.openAmount) || 0,
      orderCount: s.orderIds.length,
      localItems: 0,
      waitingSince: s.waitingSince,
      lastActivity: Date.parse(s.lastActivityAt) || 0,
    });
  }
  if (eventId) {
    for (const [key, cart] of Object.entries(parked)) {
      if (!key.startsWith(`${eventId}:`) || cart.items.length === 0) continue;
      const id = contextId(cart.context);
      const local = cartPayable(cart, chargePfand);
      const existing = byId.get(id);
      if (existing) {
        existing.amount += local;
        existing.localItems = cartItemCount(cart.items);
        existing.lastActivity = Math.max(existing.lastActivity, cart.updatedAt);
      } else {
        byId.set(id, {
          id,
          context: cart.context,
          state: 'busy',
          waitReason: null,
          amount: local,
          serverAmount: 0,
          orderCount: 0,
          localItems: cartItemCount(cart.items),
          waitingSince: null,
          lastActivity: cart.updatedAt,
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'wait' ? -1 : 1;
    if (a.state === 'wait') {
      return (Date.parse(a.waitingSince ?? '') || 0) - (Date.parse(b.waitingSince ?? '') || 0);
    }
    return b.lastActivity - a.lastActivity;
  });
}

const remainingOf = (order: Order) => Math.max(0, Number(order.total) - Number(order.paidAmount || 0));

export interface TableBill {
  /** Offener Betrag der gesendeten Bestellungen (Server ist führend). */
  sentOpen: number;
  /** Davon rabattierbar (ohne Pfand), wie die Sammelzahlung rechnet. */
  sentDiscountable: number;
  /** Bestellungen mit offenem Betrag, älteste zuerst. */
  openOrderIds: string[];
}

export function billOf(orders: Order[]): TableBill {
  const open = orders
    .filter((o) => remainingOf(o) > 0.0001)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return {
    sentOpen: open.reduce((sum, o) => sum + remainingOf(o), 0),
    sentDiscountable: open.reduce(
      (sum, o) =>
        sum +
        Math.max(0, Math.min(remainingOf(o), Number(o.subtotal) - Number(o.discountAmount || 0))),
      0,
    ),
    openOrderIds: open.map((o) => o.id),
  };
}

export { remainingOf };
