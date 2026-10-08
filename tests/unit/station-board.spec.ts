import { expect, test } from '@playwright/test';

import {
  ARCHIVE_GRACE_MS,
  ARCHIVE_LIMIT,
  LEAVE_MS,
  buildStationBoard,
  mergeSnapshot,
  pickReadyAt,
  type LocalReady,
  type StationOrder,
} from '@/lib/station-board';

const T0 = Date.parse('2026-10-08T12:00:00Z');

function order(id: string, itemIds: string[], extra: Partial<StationOrder['order']> = {}): StationOrder {
  return {
    order: {
      id,
      orderNumber: `ORD-${id}`,
      dailyNumber: 1,
      tableNumber: 'A11',
      customerName: null,
      priority: 'normal',
      createdAt: new Date(T0 - 60_000).toISOString(),
      fulfillmentType: 'table_service',
      source: 'pos',
      ...extra,
    },
    items: itemIds.map((itemId) => ({
      id: itemId,
      productName: 'Pommes',
      categoryName: 'Speisen',
      quantity: 1,
      status: 'pending',
      notes: null,
      kitchenNotes: null,
      options: null,
      createdAt: new Date(T0 - 60_000).toISOString(),
    })),
  };
}

const readyMap = (entries: Array<[string, LocalReady]>) => new Map(entries);

test.describe('station board: done cards and auto clear', () => {
  test('open orders stay open', () => {
    const board = buildStationBoard({ open: [order('o1', ['a', 'b'])], snapshots: new Map(), ready: new Map(), now: T0, autoClearSeconds: 10 });
    expect(board.cards.map((c) => c.phase)).toEqual(['open']);
    expect(board.nextChangeAt).toBeNull();
  });

  test('a locally marked item shows as ready before the refetch drops it', () => {
    const o = order('o1', ['a', 'b']);
    const board = buildStationBoard({
      open: [o],
      snapshots: new Map([['o1', o]]),
      ready: readyMap([['a', { orderId: 'o1', readyAt: T0 }]]),
      now: T0,
      autoClearSeconds: 10,
    });
    expect(board.cards[0].phase).toBe('open');
    expect(board.cards[0].items.map((i) => i.status)).toEqual(['ready', 'pending']);
  });

  test('items the API no longer lists stay visible as ready', () => {
    const before = order('o1', ['a', 'b']);
    const after = order('o1', ['b']);
    const board = buildStationBoard({
      open: [after],
      snapshots: new Map([['o1', before]]),
      ready: readyMap([['a', { orderId: 'o1', readyAt: T0 }]]),
      now: T0,
      autoClearSeconds: 0,
    });
    expect(board.cards[0].items.map((i) => [i.id, i.status])).toEqual([
      ['a', 'ready'],
      ['b', 'pending'],
    ]);
  });

  test('an order the API dropped after the last item becomes done, timed from the last ready item', () => {
    const snap = order('o1', ['a', 'b']);
    const ready = readyMap([
      ['a', { orderId: 'o1', readyAt: T0 - 3000 }],
      ['b', { orderId: 'o1', readyAt: T0 }],
    ]);
    const board = buildStationBoard({ open: [], snapshots: new Map([['o1', snap]]), ready, now: T0 + 1000, autoClearSeconds: 10 });
    expect(board.cards).toHaveLength(1);
    expect(board.cards[0].phase).toBe('done');
    expect(board.cards[0].doneAt).toBe(T0);
    expect(board.nextChangeAt).toBe(T0 + 10_000 - LEAVE_MS);
  });

  test('auto clear: fades out, then disappears and is forgotten', () => {
    const snapshots = new Map([['o1', order('o1', ['a'])]]);
    const ready = readyMap([['a', { orderId: 'o1', readyAt: T0 }]]);
    const args = { open: [], snapshots, ready, autoClearSeconds: 10 };

    const leaving = buildStationBoard({ ...args, now: T0 + 10_000 - LEAVE_MS });
    expect(leaving.cards[0].phase).toBe('leaving');
    expect(leaving.nextChangeAt).toBe(T0 + 10_000);

    const gone = buildStationBoard({ ...args, now: T0 + 10_000 });
    expect(gone.cards).toHaveLength(0);
    expect(gone.archived).toHaveLength(0);
    expect(gone.forget).toEqual(['o1']);
  });

  test('a changed setting applies immediately', () => {
    const snapshots = new Map([['o1', order('o1', ['a'])]]);
    const ready = readyMap([['a', { orderId: 'o1', readyAt: T0 }]]);
    const at = T0 + 20_000;
    expect(buildStationBoard({ open: [], snapshots, ready, now: at, autoClearSeconds: 30 }).cards[0].phase).toBe('done');
    expect(buildStationBoard({ open: [], snapshots, ready, now: at, autoClearSeconds: 10 }).forget).toEqual(['o1']);
    expect(buildStationBoard({ open: [], snapshots, ready, now: at, autoClearSeconds: 0 }).archived).toHaveLength(1);
  });

  test('without auto clear: stays in place briefly, then moves to the done area', () => {
    const snapshots = new Map([['o1', order('o1', ['a'])]]);
    const ready = readyMap([['a', { orderId: 'o1', readyAt: T0 }]]);
    const fresh = buildStationBoard({ open: [], snapshots, ready, now: T0 + 1000, autoClearSeconds: 0 });
    expect(fresh.cards.map((c) => c.phase)).toEqual(['done']);
    expect(fresh.nextChangeAt).toBe(T0 + ARCHIVE_GRACE_MS);

    const later = buildStationBoard({ open: [], snapshots, ready, now: T0 + 60 * 60_000, autoClearSeconds: 0 });
    expect(later.cards).toHaveLength(0);
    expect(later.archived.map((c) => c.order.id)).toEqual(['o1']);
    expect(later.nextChangeAt).toBeNull();
  });

  test('the done area keeps only the most recent cards per column', () => {
    const count = ARCHIVE_LIMIT + 2;
    const snapshots = new Map<string, StationOrder>();
    const ready = new Map<string, LocalReady>();
    for (let n = 0; n < count; n += 1) {
      snapshots.set(`o${n}`, order(`o${n}`, [`i${n}`]));
      ready.set(`i${n}`, { orderId: `o${n}`, readyAt: T0 + n * 1000 });
    }
    const board = buildStationBoard({ open: [], snapshots, ready, now: T0 + 3_600_000, autoClearSeconds: 0 });
    expect(board.archived).toHaveLength(ARCHIVE_LIMIT);
    expect(board.archived[0].order.id).toBe(`o${count - 1}`);
    expect(board.forget.sort()).toEqual(['o0', 'o1']);
  });

  test('orders that vanished without a local ready are forgotten, not shown as done', () => {
    const board = buildStationBoard({
      open: [],
      snapshots: new Map([['o1', order('o1', ['a'])]]),
      ready: new Map(),
      now: T0,
      autoClearSeconds: 0,
    });
    expect(board.cards).toHaveLength(0);
    expect(board.forget).toEqual(['o1']);
  });

  test('done cards keep their place among open ones (priority, then age)', () => {
    const old = order('old', ['a'], { createdAt: new Date(T0 - 600_000).toISOString() });
    const rush = order('rush', ['b'], { priority: 'rush', createdAt: new Date(T0).toISOString() });
    const young = order('young', ['c'], { createdAt: new Date(T0 - 1000).toISOString() });
    const board = buildStationBoard({
      open: [rush, young],
      snapshots: new Map([['old', old]]),
      ready: readyMap([['a', { orderId: 'old', readyAt: T0 }]]),
      now: T0,
      autoClearSeconds: 10,
    });
    expect(board.cards.map((c) => c.order.id)).toEqual(['rush', 'old', 'young']);
  });
});

test.describe('station board: helpers', () => {
  test('pickReadyAt prefers a plausible server timestamp', () => {
    expect(pickReadyAt(new Date(T0 - 2000).toISOString(), T0)).toBe(T0 - 2000);
    expect(pickReadyAt(null, T0)).toBe(T0);
    expect(pickReadyAt('kaputt', T0)).toBe(T0);
    // Server clock far off: use the device clock.
    expect(pickReadyAt(new Date(T0 - 10 * 60_000).toISOString(), T0)).toBe(T0);
    // Slightly ahead: never in the future.
    expect(pickReadyAt(new Date(T0 + 5000).toISOString(), T0)).toBe(T0);
  });

  test('mergeSnapshot keeps items from earlier states', () => {
    const merged = mergeSnapshot(order('o1', ['a', 'b']), order('o1', ['b', 'c']));
    expect(merged.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
