import type {
  LiveCashAudit,
  LiveCashAuditRow,
  PosWaiter,
  SettlementTse,
  WaiterMode,
  WaiterPermissionKey,
  WaiterPermissions,
  WaiterRole,
} from '@/types/waiter';

/** Rechte je Rolle (wie die API, `ROLE_PERMISSIONS`). */
export const ROLE_PERMISSIONS: Record<WaiterRole, Record<WaiterPermissionKey, boolean>> = {
  service: { refund: false, cashDrawer: false, discount: true, cashbook: false },
  lead: { refund: true, cashDrawer: true, discount: true, cashbook: true },
};

/** Farben neuer Bedienungen (wie die API), weiße Schrift lesbar. */
export const WAITER_COLORS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#4d7c0f',
  '#b45309',
  '#4f46e5',
  '#0f766e',
  '#be123c',
] as const;

/** Höchstzahl je Massenanlage. */
export const WAITER_BULK_MAX = 200;

/**
 * Gerätemodus aus den Geräteeinstellungen. Ohne `waiterMode` gilt der
 * frühere Schalter `requirePin` als gemeinsame Kasse.
 */
export function waiterModeOf(settings: Record<string, unknown> | null | undefined): WaiterMode {
  const mode = settings?.waiterMode;
  if (mode === 'off' || mode === 'shared' || mode === 'personal') return mode;
  return settings?.requirePin === true ? 'shared' : 'off';
}

/** Wirksame Rechte: Rolle plus Abweichungen. */
export function effectivePermissions(
  role: WaiterRole,
  overrides: WaiterPermissions | null | undefined,
): Record<WaiterPermissionKey, boolean> {
  const result = { ...ROLE_PERMISSIONS[role] };
  for (const key of Object.keys(result) as WaiterPermissionKey[]) {
    const value = overrides?.[key];
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

/** Nur Abweichungen von der Rolle speichern (Rollenwechsel nimmt sie mit). */
export function permissionOverrides(
  role: WaiterRole,
  wanted: Record<WaiterPermissionKey, boolean>,
): WaiterPermissions {
  const base = ROLE_PERMISSIONS[role];
  const out: WaiterPermissions = {};
  for (const key of Object.keys(base) as WaiterPermissionKey[]) {
    if (wanted[key] !== base[key]) out[key] = wanted[key];
  }
  return out;
}

export interface ParsedWaiterLine {
  name: string;
  shortName: string | null;
  role: WaiterRole | null;
}

export interface ParsedWaiterList {
  items: ParsedWaiterLine[];
  /** Zeilennummern (ab 1) mit Fehler: Name zu lang, Kurzname zu lang, Rolle unbekannt. */
  invalid: number[];
  /** Doppelte Namen (Groß/klein egal), nur einmal übernommen. */
  duplicates: string[];
}

const ROLE_WORDS: Record<string, WaiterRole> = {
  service: 'service',
  bedienung: 'service',
  server: 'service',
  lead: 'lead',
  schichtleitung: 'lead',
  'shift lead': 'lead',
  leitung: 'lead',
};

/**
 * Namensliste für die Massenanlage: eine Bedienung je Zeile, wahlweise als
 * CSV `Name;Kurzname;Rolle` (auch mit Komma oder Tab). Leere Zeilen und
 * eine Kopfzeile („Name;…“) fallen weg.
 */
export function parseWaiterList(text: string): ParsedWaiterList {
  const items: ParsedWaiterLine[] = [];
  const invalid: number[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const separator = /[;\t]/.test(line) ? /[;\t]/ : ',';
    const parts = line.split(separator).map((p) => p.trim());
    const [name = '', shortName = '', roleWord = ''] = parts;
    if (index === 0 && /^name$/i.test(name)) return;
    const role = roleWord ? (ROLE_WORDS[roleWord.toLowerCase()] ?? null) : null;
    if (!name || name.length > 100 || shortName.length > 12 || (roleWord && !role)) {
      invalid.push(index + 1);
      return;
    }
    const key = name.toLocaleLowerCase('de');
    if (seen.has(key)) {
      duplicates.push(name);
      return;
    }
    seen.add(key);
    items.push({ name, shortName: shortName || null, role });
  });
  return { items, invalid, duplicates };
}

/** Kurzname für Chip und Kacheln: eigener Kurzname, sonst erstes Wort. */
export function waiterLabel(waiter: { name: string; shortName?: string | null }): string {
  return waiter.shortName?.trim() || waiter.name.trim().split(/\s+/)[0]?.slice(0, 12) || waiter.name;
}

/** Initialen (höchstens zwei Buchstaben). */
export function waiterInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Schwarz oder weiß auf der Farbe (WCAG-Kontrast). */
export function textOn(color: string | null | undefined): '#000' | '#fff' {
  const hex = /^#([0-9a-f]{6})$/i.exec(color ?? '')?.[1];
  if (!hex) return '#fff';
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return lum > 0.4 ? '#000' : '#fff';
}

/** Tisch-Filter der Kasse: „Meine“ = meine Tische und noch niemandem zugeordnete. */
export type TableFilter = 'mine' | 'all';

export function isMyTable(
  entry: { waiterIds?: string[] | null; localItems?: number },
  waiterId: string | null | undefined,
): boolean {
  if (!waiterId) return true;
  if ((entry.localItems ?? 0) > 0) return true;
  const ids = entry.waiterIds ?? [];
  return ids.length === 0 || ids.includes(waiterId);
}

/** Gehört der Tisch jemand anderem (Hinweis „Tisch von …“)? */
export function foreignOwner(
  entry: { waiterId?: string | null } | null | undefined,
  waiterId: string | null | undefined,
): string | null {
  const owner = entry?.waiterId ?? null;
  return owner && waiterId && owner !== waiterId ? owner : null;
}

/**
 * Automatische Sperre fällig? Nie während einer laufenden Zahlung
 * (`busy`) oder ohne eingestellte Zeit.
 */
export function shouldAutoLock(
  lastActivity: number,
  now: number,
  seconds: number | null | undefined,
  busy: boolean,
): boolean {
  if (!seconds || seconds <= 0 || busy) return false;
  return now - lastActivity >= seconds * 1000;
}

/** Wirksame Sperrzeit: Einstellung, bei gemeinsamer Kasse sonst 120 s. */
export function autoLockSecondsOf(settings: Record<string, unknown> | null | undefined): number {
  const value = Number(settings?.autoLockSeconds);
  if (Number.isFinite(value) && value >= 0 && settings?.autoLockSeconds !== undefined && settings?.autoLockSeconds !== null) {
    return value;
  }
  return waiterModeOf(settings) === 'shared' ? 120 : 0;
}

/** Darf die angemeldete Person das selbst (ohne Freigabe)? Ohne Person: ja. */
export function may(waiter: PosWaiter | null | undefined, permission: WaiterPermissionKey): boolean {
  return !waiter || waiter.permissions?.[permission] !== false;
}

/** PIN-Zettel: Karten je A4-Seite (2 Spalten × 5 Zeilen). */
export const PIN_CARDS_PER_PAGE = 10;

export function pinSheetPages<T>(cards: T[], perPage = PIN_CARDS_PER_PAGE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < cards.length; i += perPage) pages.push(cards.slice(i, i + perPage));
  return pages;
}

// ------------------------------------------------------------ Abrechnung

/** Abrechnen gesperrt: offene Tische, außer „trotzdem“ mit Notiz. */
export function settlementBlocked(openTables: number, force: boolean, note: string): boolean {
  return openTables > 0 && !(force && note.trim().length > 0);
}

/** Schichtleitung oder Admin-Mitglied: rechnet andere ab (Server prüft). */
export function isLeadWaiter(waiter: Pick<PosWaiter, 'role'> | null | undefined): boolean {
  return waiter?.role === 'lead' || waiter?.role === 'admin';
}

/** Empfänger einer Tischübergabe: alle außer der bisherigen Bedienung. */
export function handoverTargets<T extends { id: string }>(tiles: T[], excludeId: string | null | undefined): T[] {
  return tiles.filter((tile) => tile.id !== excludeId);
}

/**
 * `isEmployee` nur mitschicken, wenn er sich ändert (neu: nur wenn an) —
 * so bleibt Anlegen und Bearbeiten mit einer API ohne das Feld möglich.
 */
export function employeeFlagPatch(previous: boolean | undefined, next: boolean): { isEmployee?: boolean } {
  return (previous === true) === next ? {} : { isEmployee: next };
}

// ------------------------------------------ Kassen-Nachschau, Trinkgeld

/**
 * TSE-Zustand einer Kellnerabrechnung (Cloud-TSE, `SonstigerVorgang`):
 * `signed` mit TA-Nr., `failed` (TSE nicht erreichbar) oder `null` (ohne
 * TSE, Training, ältere API).
 */
export function settlementTseState(
  tse: SettlementTse | null | undefined,
): { kind: 'signed'; transactionNumber: number | null; bonNumber: number | null } | { kind: 'failed' } | null {
  if (!tse) return null;
  if (tse.failed || tse.status === 'failed' || tse.status === 'pending') return { kind: 'failed' };
  return { kind: 'signed', transactionNumber: tse.transactionNumber, bonNumber: tse.bonNumber };
}

/**
 * Kartentrinkgeld auszahlen anbieten? Nur bei Arbeitnehmern (die API
 * liefert `openCardTips` sonst als null) und wenn etwas offen ist.
 */
export function canPayOutCardTips(openCardTips: number | null | undefined): boolean {
  return typeof openCardTips === 'number' && Math.round(openCardTips * 100) > 0;
}

/** Wo das Bargeld einer Bedienung liegt: Schubladen mit Betrag, größte zuerst. */
export function liveAuditDrawers(
  row: Pick<LiveCashAuditRow, 'cashByDevice'>,
): Array<{ deviceId: string | null; deviceName: string | null; amount: number }> {
  return (row.cashByDevice ?? [])
    .filter((d) => Math.round(d.amount * 100) !== 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * CSV-Zeilen des Live-Kassensturzes (Beträge als Zahl, Schubladen als
 * „Name: Betrag“): Bedienung, Soll bar, Schubladen, Karte, Trinkgeld,
 * offene Tische, offenes Kartentrinkgeld, letzte Abrechnung.
 */
export function liveAuditCsvRows(
  audit: Pick<LiveCashAudit, 'rows'>,
  labels: { noDevice: string },
): Array<Array<string | number>> {
  return audit.rows.map((row) => [
    row.subject.name,
    row.cashExpected ?? '',
    liveAuditDrawers(row)
      .map((d) => `${d.deviceName ?? labels.noDevice}: ${d.amount.toFixed(2)}`)
      .join('; '),
    row.payments?.card.amount ?? '',
    row.tips ?? '',
    row.openTables,
    row.openCardTips ?? '',
    row.lastSettlement?.number ?? '',
  ]);
}
