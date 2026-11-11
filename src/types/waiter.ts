/**
 * Bedienungen (Kassenprofile mit PIN), bedienungen-plan.md. Im Code
 * `waiter`, in der Oberfläche „Bedienungen“ (EN „Servers“).
 */
export type WaiterRole = 'service' | 'lead';
export const WAITER_ROLES: WaiterRole[] = ['service', 'lead'];

export type WaiterPermissionKey = 'refund' | 'cashDrawer' | 'discount' | 'cashbook';
export const WAITER_PERMISSION_KEYS: WaiterPermissionKey[] = ['refund', 'cashDrawer', 'discount', 'cashbook'];
export type WaiterPermissions = Partial<Record<WaiterPermissionKey, boolean>>;

/** Gerätemodus: ohne Bedienung, gemeinsame Kasse (PIN), feste Bedienung. */
export type WaiterMode = 'off' | 'shared' | 'personal';

/** Bedienung in der Verwaltung (GET /organizations/:id/waiters, ohne PIN). */
export interface Waiter {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  role: WaiterRole;
  permissions: WaiterPermissions;
  effectivePermissions: Record<WaiterPermissionKey, boolean>;
  eventId: string | null;
  /**
   * Arbeitnehmer (Lohnkonto), z. B. Minijob: Trinkgeld als TrinkgeldAN
   * (steuerfrei). Ehrenamtliche nicht (Trinkgeld an den Verein,
   * TrinkgeldAG). Fehlt bei älteren API-Versionen.
   */
  isEmployee?: boolean;
  isActive: boolean;
  hasPin: boolean;
  pinLength: number | null;
  lastUsedAt: string | null;
  anonymizedAt: string | null;
  /** Ab wann der Löschlauf sie anonymisiert (null = keine Frist). */
  anonymizeDueAt?: string | null;
  createdAt: string;
}

/** Antwort beim Anlegen bzw. „PIN neu“: die PIN steht nur hier, einmalig. */
export type WaiterWithPin = Waiter & { pin: string };

export interface WaiterListMeta {
  /** 0 = unbegrenzt. */
  limit: number;
  count: number;
  pinLength: number;
}

export interface CreateWaiterData {
  name: string;
  shortName?: string | null;
  color?: string | null;
  role?: WaiterRole;
  permissions?: WaiterPermissions;
  eventId?: string | null;
  /** Arbeitnehmer (Lohnkonto); Standard false. */
  isEmployee?: boolean;
  pin?: string;
}

export type UpdateWaiterData = Partial<Omit<CreateWaiterData, 'pin'>> & { isActive?: boolean };

export interface BulkCreateWaitersData {
  eventId?: string | null;
  role?: WaiterRole;
  items: Array<{ name: string; shortName?: string | null; role?: WaiterRole }>;
}

/** Wer an der Kasse bucht (Bedienung oder Mitglied mit Mitglieds-PIN). */
export interface PosWaiter {
  kind: 'waiter' | 'member';
  /** Bedienung bzw. Benutzer. */
  id: string;
  waiterId: string | null;
  userId: string | null;
  name: string;
  shortName: string | null;
  color: string | null;
  role: WaiterRole | 'admin' | 'member';
  permissions: Record<WaiterPermissionKey, boolean>;
}

/** POST /device-api/waiter-session */
export interface WaiterSessionResponse {
  token?: string;
  sessionId: string;
  expiresAt: string;
  kind: 'waiter' | 'member';
  waiter: PosWaiter;
}

/** GET /device-api/waiters (Kacheln, Tischfarben). */
export interface DeviceWaiterTile {
  id: string;
  shortName: string;
  color: string | null;
}

export interface OrganizationWaiterSettings {
  pinLength?: 4 | 6;
  wallet?: boolean;
  foreignTables?: 'allow' | 'warn';
  selfSettlement?: boolean;
  receiptName?: 'short' | 'full';
}

// ------------------------------------------------------------ Abrechnung

export interface SettlementCount {
  count: number;
  amount: number;
}

/** Schnappschuss der Zahlen (bedienungen-plan.md §7); „Nur Bons“: nur Mengen. */
export interface SettlementTotals {
  operatingMode: 'full' | 'cashless' | 'orders_only';
  payments?: { cash: SettlementCount; card: SettlementCount; other: SettlementCount; total: SettlementCount };
  tips?: number;
  refunds?: { cash: SettlementCount; nonCash: SettlementCount; total: SettlementCount };
  pfandReturns?: SettlementCount;
  taken: { orders: number; items: number; revenue?: number; discounts?: number };
  cashExpected?: number;
  cashByDevice?: Array<{ deviceId: string | null; deviceName: string | null; amount: number }>;
  training: { orders: number; payments: number; amount?: number };
}

export interface SettlementOpenTable {
  orderId: string;
  orderNumber: string;
  dailyNumber: number | null;
  tableNumber: string | null;
  openAmount?: number;
}

export interface SettlementSubject {
  kind: 'waiter' | 'member';
  id: string;
  waiterId: string | null;
  userId: string | null;
  name: string;
  shortName: string | null;
  color: string | null;
  anonymized: boolean;
}

/** Zwischenstand (GET …/summary). */
export interface WaiterSummary {
  subject: SettlementSubject;
  eventId: string;
  eventName: string | null;
  periodFrom: string | null;
  periodTo: string;
  totals: SettlementTotals;
  openTables: SettlementOpenTable[];
  wallet: boolean;
  lastSettlement: { id: string; number: number | null; createdAt: string } | null;
  empty: boolean;
}

export interface WaiterSettlement {
  id: string;
  number: number | null;
  isTest: boolean;
  subject: SettlementSubject;
  eventId: string | null;
  eventName: string | null;
  periodFrom: string | null;
  periodTo: string;
  totals: SettlementTotals;
  cashExpected: number | null;
  cashCounted: number | null;
  difference: number | null;
  wallet: boolean;
  openTables: SettlementOpenTable[];
  forced: boolean;
  note: string | null;
  settledBy: { kind: 'user' | 'waiter'; id: string; name: string } | null;
  deviceId: string | null;
  deviceName: string | null;
  printedAt: string | null;
  /**
   * Cloud-TSE: als `SonstigerVorgang` abgesichert (Soll, Ist, Differenz).
   * null ohne TSE bzw. bei Training; fehlt bei älteren API-Versionen.
   */
  tse?: SettlementTse | null;
  createdAt: string;
}

export interface SettlementTse {
  status: string;
  /** Nicht signiert (TSE nicht erreichbar). */
  failed: boolean;
  bonNumber: number | null;
  transactionNumber: number | null;
  signatureCounter: number | null;
  finishTime: string | null;
}

export interface SettleWaiterData {
  eventId?: string;
  countedCash?: number | null;
  force?: boolean;
  note?: string | null;
  printerId?: string;
  /** Offenes Kartentrinkgeld gleich bar auszahlen (nur Arbeitnehmer). */
  payOutCardTips?: boolean;
}

/** `meta` beim Abrechnen. */
export interface SettleMeta {
  printed: boolean;
  /** Mit `payOutCardTips`: die Auszahlung, sonst null (fehlt bei älteren APIs). */
  tipPayout?: TipPayout | null;
}

// ------------------------------------------------ Live-Kassensturz

/** Zeile des Live-Kassensturzes: eine Bedienung seit ihrer letzten Abrechnung. */
export interface LiveCashAuditRow {
  subject: SettlementSubject;
  periodFrom: string | null;
  /** Soll bar seit der letzten Abrechnung; null bei „Nur Bons“. */
  cashExpected: number | null;
  cashByDevice?: Array<{ deviceId: string | null; deviceName: string | null; amount: number }>;
  payments?: { cash: SettlementCount; card: SettlementCount; other: SettlementCount; total: SettlementCount };
  tips: number | null;
  refunds?: { cash: SettlementCount; nonCash: SettlementCount; total: SettlementCount };
  pfandReturns?: SettlementCount;
  openTables: number;
  /** Nur Arbeitnehmer (Lohnkonto): noch nicht ausgezahltes Kartentrinkgeld; sonst null. */
  openCardTips: number | null;
  lastSettlement: { id: string; number: number | null; createdAt: string } | null;
}

/** GET …/waiter-settlements/live bzw. /device-api/waiter/live-cash-audit */
export interface LiveCashAudit {
  generatedAt: string;
  eventId: string | null;
  eventName: string | null;
  rows: LiveCashAuditRow[];
  total: { cashExpected: number; payments: number; tips: number };
}

// ------------------------------------------- Kartentrinkgeld auszahlen

export interface TipPayout {
  id: string;
  waiterId: string;
  waiterName: string;
  amount: number;
  isTest: boolean;
  settlementId: string | null;
  deviceId: string | null;
  note: string | null;
  tse: import('@/types/tse').TseReceiptView | null;
  createdAt: string;
}

/** GET …/waiters/:waiterId/tip-payouts */
export interface TipPayoutStatus {
  isEmployee: boolean;
  openCardTips: number;
  payouts: TipPayout[];
}

export interface TipPayoutData {
  /** Euro; ohne: das ganze offene Kartentrinkgeld. */
  amount?: number;
  eventId?: string;
  note?: string | null;
  printerId?: string;
}

/** Rechte an der Kasse (meta von GET /device-api/waiter/summary). */
export interface SettleRights {
  canSettle: boolean;
  canForce: boolean;
}

export interface TransferResult {
  orderIds: string[];
  toWaiter: { id: string; name: string; shortName: string | null; color: string | null };
  fromWaiterIds: Array<string | null>;
  eventId: string | null;
  tableNumber: string | null;
}

/** Bericht „Bedienungen“ (GET /organizations/:id/reports/waiters). */
export interface WaiterReportRow {
  kind: 'waiter' | 'member' | 'none';
  waiterId: string | null;
  userId: string | null;
  name: string;
  shortName: string | null;
  color: string | null;
  role: string | null;
  orders: number;
  items: number;
  revenue?: number;
  payments: number;
  collected?: number;
  cashAmount?: number;
  cardAmount?: number;
  otherAmount?: number;
  tips?: number;
  refundCount: number;
  refunds?: number;
  pfandReturned?: number;
  settlements: number;
  openOrders: number;
}
