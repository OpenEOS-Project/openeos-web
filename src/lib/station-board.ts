/**
 * Was die Stationsanzeige zeigt: offene Bestellungen aus der API plus die
 * Positionen, die an diesem Bildschirm gerade fertig gemeldet wurden.
 *
 * Die API liefert nur offene Positionen. Eine fertig gemeldete Position
 * verschwindet beim naechsten Abruf, eine Karte mit der letzten Position
 * ganz — ohne jede Rueckmeldung. Deshalb merkt sich die Anzeige, was sie
 * selbst fertig gemeldet hat, und zeigt es als erledigt an, bis die
 * Einstellung "Erledigte ausblenden" (`autoClearSeconds`) es wegnimmt.
 *
 * Reine Funktionen ohne React, damit sich die Zeitlogik testen laesst.
 */

export interface StationItem {
  id: string;
  productName: string;
  categoryName: string;
  quantity: number;
  status: string;
  notes: string | null;
  kitchenNotes: string | null;
  options: unknown;
  createdAt: string;
}

export interface StationOrderInfo {
  id: string;
  orderNumber: string;
  dailyNumber: number;
  tableNumber: string | null;
  customerName: string | null;
  priority: string;
  createdAt: string;
  fulfillmentType: string;
  source: string;
  /** Notiz zur Bestellung; die Kasse markiert damit To-go. */
  notes?: string | null;
}

export interface StationOrder {
  order: StationOrderInfo;
  items: StationItem[];
}

/** Eine an diesem Bildschirm fertig gemeldete Position. */
export interface LocalReady {
  orderId: string;
  /** Zeitpunkt der Fertigmeldung (ms seit Epoche). */
  readyAt: number;
}

/**
 * - `open`: noch etwas zu tun
 * - `done`: alle Positionen fertig, Karte steht noch
 * - `leaving`: wird gerade ausgeblendet
 */
export type CardPhase = 'open' | 'done' | 'leaving';

export interface BoardCard extends StationOrder {
  phase: CardPhase;
  /** Zeitpunkt, an dem die letzte Position fertig wurde. */
  doneAt: number | null;
}

export interface StationBoard {
  /** Karten an ihrem Platz in der Spalte (offen und frisch erledigt). */
  cards: BoardCard[];
  /** Erledigte Karten fuer den abgesetzten Bereich (nur bei `autoClearSeconds` 0). */
  archived: BoardCard[];
  /** Naechster Zeitpunkt, an dem sich etwas aendert — dann neu rechnen. */
  nextChangeAt: number | null;
  /** Bestellungen, die nicht mehr angezeigt werden: Merkliste aufraeumen. */
  forget: string[];
}

/** Dauer des Ausblendens; muss zur CSS-Transition der Karte passen. */
export const LEAVE_MS = 700;
/** Ohne Ausblenden: so lange bleibt eine erledigte Karte noch an ihrem Platz. */
export const ARCHIVE_GRACE_MS = 5000;
/** Ohne Ausblenden: so viele erledigte Karten haelt eine Spalte vor. */
export const ARCHIVE_LIMIT = 6;
/** Weicht die Serverzeit staerker ab, gilt die Uhr des Geraets. */
const MAX_CLOCK_SKEW_MS = 60_000;

export function isItemReady(item: Pick<StationItem, 'status'>): boolean {
  return item.status === 'ready' || item.status === 'delivered';
}

/**
 * Zeitpunkt einer Fertigmeldung: der Zeitstempel aus der API, wenn er
 * plausibel ist, sonst die Uhr des Geraets. Eine falsch gehende Uhr auf
 * einer Seite soll eine Karte weder sofort verschwinden noch ewig stehen
 * lassen.
 */
export function pickReadyAt(serverValue: string | null | undefined, now: number): number {
  if (!serverValue) return now;
  const parsed = Date.parse(serverValue);
  if (!Number.isFinite(parsed) || Math.abs(parsed - now) > MAX_CLOCK_SKEW_MS) return now;
  return Math.min(parsed, now);
}

/** Merkt sich eine Bestellung; Positionen frueherer Stande bleiben erhalten. */
export function mergeSnapshot(previous: StationOrder | undefined, next: StationOrder): StationOrder {
  if (!previous) return next;
  const known = new Set(next.items.map((item) => item.id));
  const earlier = previous.items.filter((item) => !known.has(item.id));
  return { order: next.order, items: [...earlier, ...next.items] };
}

function priorityRank(priority: string): number {
  return priority === 'rush' ? 2 : priority === 'high' ? 1 : 0;
}

/** Wie die API sortiert: dringend zuerst, dann die aelteste. */
function compareCards(a: BoardCard, b: BoardCard): number {
  return (
    priorityRank(b.order.priority) - priorityRank(a.order.priority) ||
    Date.parse(a.order.createdAt) - Date.parse(b.order.createdAt)
  );
}

function columnOf(order: StationOrderInfo): string {
  return order.fulfillmentType === 'table_service' ? 'service' : 'pickup';
}

export function buildStationBoard({
  open,
  snapshots,
  ready,
  now,
  autoClearSeconds,
}: {
  /** Offene Bestellungen laut API. */
  open: StationOrder[];
  /** Bestellungen zum Zeitpunkt der letzten Fertigmeldung an diesem Bildschirm. */
  snapshots: ReadonlyMap<string, StationOrder>;
  /** Fertig gemeldete Positionen, nach Positions-ID. */
  ready: ReadonlyMap<string, LocalReady>;
  now: number;
  /** 0 = nie ausblenden. */
  autoClearSeconds: number;
}): StationBoard {
  const forget: string[] = [];
  const candidates: BoardCard[] = [];
  const openIds = new Set(open.map((entry) => entry.order.id));

  const doneAtOf = (items: StationItem[]): number | null => {
    let latest: number | null = null;
    for (const item of items) {
      const local = ready.get(item.id);
      if (local && (latest === null || local.readyAt > latest)) latest = local.readyAt;
    }
    return latest;
  };

  for (const entry of open) {
    const snapshot = snapshots.get(entry.order.id);
    const listed = new Set(entry.items.map((item) => item.id));
    /* Was die API nicht mehr listet, ist nicht mehr offen: hier oder an
       einem anderen Bildschirm fertig gemeldet. Reihenfolge wie zuvor. */
    const gone = (snapshot?.items ?? [])
      .filter((item) => !listed.has(item.id))
      .map((item) => ({ ...item, status: 'ready' }));
    const current = entry.items.map((item) => (ready.has(item.id) ? { ...item, status: 'ready' } : item));
    const items = [...gone, ...current];

    if (!items.every(isItemReady)) {
      candidates.push({ ...entry, items, phase: 'open', doneAt: null });
      continue;
    }
    candidates.push({ ...entry, items, phase: 'done', doneAt: doneAtOf(items) ?? now });
  }

  for (const [orderId, snapshot] of snapshots) {
    if (openIds.has(orderId)) continue;
    const items = snapshot.items.map((item) => ({ ...item, status: 'ready' }));
    const doneAt = doneAtOf(items);
    /* Ohne eigene Fertigmeldung (z. B. storniert oder woanders erledigt)
       gibt es hier nichts zu bestaetigen. */
    if (doneAt === null) {
      forget.push(orderId);
      continue;
    }
    candidates.push({ ...snapshot, items, phase: 'done', doneAt });
  }

  const cards: BoardCard[] = [];
  const archived: BoardCard[] = [];
  let nextChangeAt: number | null = null;
  const later = (at: number) => {
    if (nextChangeAt === null || at < nextChangeAt) nextChangeAt = at;
  };

  for (const card of candidates) {
    if (card.phase === 'open' || card.doneAt === null) {
      cards.push(card);
      continue;
    }
    if (autoClearSeconds > 0) {
      const end = card.doneAt + autoClearSeconds * 1000;
      if (now >= end) {
        forget.push(card.order.id);
      } else if (now >= end - LEAVE_MS) {
        cards.push({ ...card, phase: 'leaving' });
        later(end);
      } else {
        cards.push(card);
        later(end - LEAVE_MS);
      }
      continue;
    }
    const archiveAt = card.doneAt + ARCHIVE_GRACE_MS;
    if (now >= archiveAt) {
      archived.push(card);
    } else {
      cards.push(card);
      later(archiveAt);
    }
  }

  cards.sort(compareCards);
  archived.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  /* Ohne Ausblenden wuerde der Bereich den ganzen Abend wachsen. */
  const perColumn = new Map<string, number>();
  const keptArchive = archived.filter((card) => {
    const column = columnOf(card.order);
    const count = (perColumn.get(column) ?? 0) + 1;
    perColumn.set(column, count);
    if (count > ARCHIVE_LIMIT) {
      forget.push(card.order.id);
      return false;
    }
    return true;
  });

  return { cards, archived: keptArchive, nextChangeAt, forget };
}
