/**
 * Tische und Tischplan — Vertrag mit der API (Spezifikation „Kasse +
 * Tische“, §3.3/§3.4). Die Endpunkte kommen mit openeos-api `feat/tables`
 * (Verwaltung) und `feat/device-tables` (Kasse); die Typen stehen schon
 * vorher fest, damit Verwaltung und Kasse parallel entstehen können.
 */
import type { Order } from './order';
import type { Payment, PaymentMethod } from './payment';

/* ---------- Grundbegriffe ---------- */

/**
 * Tischbetrieb einer Veranstaltung (`event.settings.tables.mode`):
 * `none` Theke für alle Kassen · `free` freie Nummer (Default, wenn nichts
 * gesetzt ist) · `predefined` nur angelegte Tische.
 */
export type TableMode = 'none' | 'free' | 'predefined';

export type DiningTableShape = 'rect' | 'round';

export type TableDecorType = 'bar' | 'wall' | 'stage' | 'label';

/** Serverseitig abgeleiteter Zustand; Tische ohne Eintrag sind frei. */
export type TableStatus = 'busy' | 'wait';

/** `event.settings.tables` — `areaIds: null` heißt alle Bereiche. */
export interface EventTablesSettings {
  mode: TableMode;
  areaIds?: string[] | null;
}

/** Deko-Element auf der Karte eines Bereichs (Einheiten bzw. Grad). */
export interface TableDecor {
  id: string;
  type: TableDecorType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
}

export interface DiningTable {
  id: string;
  organizationId: string;
  areaId: string;
  /** 1–20 Zeichen, org-weit eindeutig (Groß-/Kleinschreibung egal). */
  label: string;
  seats: number | null;
  shape: DiningTableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Bereich mit eigener Karte (Default 1200 × 800 Einheiten, Raster 20). */
export interface TableArea {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
  width: number;
  height: number;
  gridSize: number;
  decor: TableDecor[];
  createdAt: string;
  updatedAt: string;
  /** Verwaltung: aktive und inaktive Tische, sortiert. */
  tables: DiningTable[];
}

/* ---------- Verwaltung: /organizations/:orgId/table-areas, /tables ---------- */

export interface CreateTableAreaData {
  name: string;
  width?: number;
  height?: number;
  gridSize?: number;
}

export interface UpdateTableAreaData {
  name?: string;
  width?: number;
  height?: number;
  gridSize?: number;
  decor?: TableDecor[];
}

/** PATCH …/table-areas/order */
export interface ReorderTableAreasData {
  ids: string[];
}

export interface TableLayoutItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape?: DiningTableShape;
}

/** PUT …/table-areas/:areaId/layout — Autosave der Karte in einer Transaktion. */
export interface SaveTableLayoutData {
  tables: TableLayoutItem[];
  decor: TableDecor[];
}

export interface CreateDiningTableData {
  areaId: string;
  label: string;
  seats?: number;
  shape?: DiningTableShape;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface UpdateDiningTableData extends Partial<Omit<CreateDiningTableData, 'seats'>> {
  seats?: number | null;
  isActive?: boolean;
}

/** POST …/tables/bulk — z. B. Präfix „A“, Start 1, Anzahl 12, Stellen 2 → A01…A12. */
export interface BulkCreateDiningTablesData {
  areaId: string;
  prefix: string;
  start: number;
  /** 1–100 */
  count: number;
  /** 0–3 führende Nullen */
  padding: number;
  seats?: number;
  shape?: DiningTableShape;
  /** Anordnung im Raster; ohne Angabe legt die API eine Reihe an. */
  layout?: { cols: number; gap: number };
}

/** 409 von …/tables/bulk: nichts angelegt, diese Bezeichnungen sind belegt. */
export interface BulkCreateConflict {
  conflicts: string[];
}

/* ---------- Kasse: /device-api/… ---------- */

export interface DeviceTableArea {
  id: string;
  name: string;
  sortOrder: number;
  width: number;
  height: number;
  gridSize: number;
  decor: TableDecor[];
  /** Nur aktive Tische (ohne Verwaltungsfelder). */
  tables: DeviceDiningTable[];
}

export type DeviceDiningTable = Pick<
  DiningTable,
  'id' | 'areaId' | 'label' | 'seats' | 'shape' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'sortOrder'
>;

/** GET /device-api/tables — gefiltert auf `event.settings.tables.areaIds`. */
export interface DeviceTablesResponse {
  /** Event, für das die Antwort gilt (aktives bzw. Test-Event); ohne Event `null`. */
  eventId: string | null;
  mode: TableMode;
  areas: DeviceTableArea[];
}

/** Eintrag aus GET /device-api/tables/status?eventId= (nur Tische ≠ frei). */
export interface DeviceTableStatus {
  /** Tischschlüssel `upper(trim(label))` — gruppiert auch Altdaten und freie Nummern. */
  key: string;
  tableId: string | null;
  label: string;
  areaId: string | null;
  status: TableStatus;
  /** Σ(total − paidAmount) der offenen Bestellungen. */
  openAmount: number;
  itemCount: number;
  orderIds: string[];
  waitingSince: string | null;
  lastActivityAt: string;
}

/** Query von GET /device-api/orders/open (ohne `eventId`: aktives bzw. Test-Event). */
export interface DeviceOpenOrdersQuery {
  eventId?: string;
  tableKey?: string;
  tableId?: string;
  /** z. B. `counter_pickup`: nur Bestellungen ohne Tisch (Theke/To-go). */
  fulfillmentType?: 'table_service' | 'counter_pickup';
}

/** POST /device-api/tables/acknowledge — quittiert Gastbestellungen des Tisches. */
export interface AcknowledgeTableData {
  tableKey: string;
  eventId?: string;
}

/** POST /device-api/order-items/deliver — Positionen `ready → delivered`. */
export interface DeliverOrderItemsData {
  itemIds: string[];
}

/** POST /device-api/payments/batch — alle Bestellungen in einer Transaktion. */
export interface PaymentsBatchData {
  /** 1–50 */
  orderIds: string[];
  paymentMethod: PaymentMethod;
  amountReceived?: number;
  tipAmount?: number;
  providerTransactionId?: string;
  metadata?: Record<string, unknown>;
  discountAmount?: number;
  discountReason?: string;
}

export interface PaymentsBatchResponse {
  orders: Order[];
  payments: Payment[];
  totalPaid: number;
  change: number;
}

/** Antwort von POST /device-api/order-items/deliver. */
export interface DeliverOrderItemsResponse {
  delivered: { id: string; orderId: string; productName: string }[];
  /** Waren schon serviert (zweite Kasse war schneller) — kein Fehler. */
  skipped: string[];
}

/** GET /device-api/status — Kopf-Pillen der Kasse (Drucker, TSE). */
export interface DevicePosStatusResponse {
  printer: { id: string; name: string; isOnline: boolean; lastSeenAt: string | null } | null;
  /** Erst mit aktiver fiskaly-Integration gefüllt. */
  tse: { state: 'ok' | 'error'; provider: 'fiskaly' } | null;
}

/* ---------- Kassen-Kontext ---------- */

/**
 * Wofür die Kasse gerade bucht: ein Tisch, die Theke oder To-go.
 * `null` (nicht Teil des Typs) bedeutet Startansicht.
 */
export type PosTableContext =
  | { kind: 'table'; key: string; label: string; tableId?: string; areaId?: string }
  | { kind: 'counter' }
  | { kind: 'togo' };

/** Tischschlüssel wie in der API: `upper(trim(label))`. */
export function toTableKey(label: string): string {
  return label.trim().toUpperCase();
}
