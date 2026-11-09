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
  isActive: boolean;
  hasPin: boolean;
  pinLength: number | null;
  lastUsedAt: string | null;
  anonymizedAt: string | null;
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
