import { expect, test } from '@playwright/test';

import {
  ROLE_PERMISSIONS,
  canPayOutCardTips,
  liveAuditCsvRows,
  liveAuditDrawers,
  settlementTseState,
  autoLockSecondsOf,
  effectivePermissions,
  employeeFlagPatch,
  foreignOwner,
  handoverTargets,
  isLeadWaiter,
  isMyTable,
  may,
  parseWaiterList,
  permissionOverrides,
  pinSheetPages,
  settlementBlocked,
  shouldAutoLock,
  textOn,
  waiterInitials,
  waiterLabel,
  waiterModeOf,
} from '@/lib/waiters';
import type { LiveCashAuditRow, PosWaiter } from '@/types/waiter';
import de from '@/messages/de.json';
import en from '@/messages/en.json';

test.describe('Bedienungen: Gerätemodus', () => {
  test('maps the former requirePin switch to the shared till', () => {
    expect(waiterModeOf(null)).toBe('off');
    expect(waiterModeOf({ requirePin: true })).toBe('shared');
    expect(waiterModeOf({ requirePin: true, waiterMode: 'off' })).toBe('off');
    expect(waiterModeOf({ waiterMode: 'personal' })).toBe('personal');
    expect(waiterModeOf({ waiterMode: 'nonsense' })).toBe('off');
  });

  test('locks a shared till after 120 s by default, never otherwise', () => {
    expect(autoLockSecondsOf({ waiterMode: 'shared' })).toBe(120);
    expect(autoLockSecondsOf({ waiterMode: 'shared', autoLockSeconds: 0 })).toBe(0);
    expect(autoLockSecondsOf({ waiterMode: 'shared', autoLockSeconds: 300 })).toBe(300);
    expect(autoLockSecondsOf({ waiterMode: 'off' })).toBe(0);
    expect(autoLockSecondsOf({ waiterMode: 'personal' })).toBe(0);
  });

  test('auto-lock is due after the idle time, but never during a payment', () => {
    expect(shouldAutoLock(0, 119_000, 120, false)).toBe(false);
    expect(shouldAutoLock(0, 120_000, 120, false)).toBe(true);
    expect(shouldAutoLock(0, 999_000, 120, true)).toBe(false);
    expect(shouldAutoLock(0, 999_000, 0, false)).toBe(false);
  });
});

test.describe('Bedienungen: Rollen und Rechte', () => {
  test('derives rights from the role plus overrides and stores only the differences', () => {
    expect(effectivePermissions('service', {})).toEqual(ROLE_PERMISSIONS.service);
    const wanted = { ...ROLE_PERMISSIONS.service, refund: true };
    expect(permissionOverrides('service', wanted)).toEqual({ refund: true });
    expect(effectivePermissions('service', { refund: true }).refund).toBe(true);
    expect(permissionOverrides('lead', ROLE_PERMISSIONS.lead)).toEqual({});
  });

  test('without a person at the till everything works as before', () => {
    const server: PosWaiter = {
      kind: 'waiter',
      id: 'w1',
      waiterId: 'w1',
      userId: null,
      name: 'Anna',
      shortName: null,
      color: null,
      role: 'service',
      permissions: { ...ROLE_PERMISSIONS.service },
    };
    expect(may(null, 'cashDrawer')).toBe(true);
    expect(may(server, 'cashDrawer')).toBe(false);
    expect(may(server, 'discount')).toBe(true);
  });
});

test.describe('Bedienungen: Namensliste (Massenanlage)', () => {
  test('reads one name per line, CSV with short name and role, skips header and blanks', () => {
    const parsed = parseWaiterList('Name;Kurzname;Rolle\nAnna Berger;Anna\n\nBen Krämer\nLea Schmidt;Lea;Schichtleitung\n');
    expect(parsed.items).toEqual([
      { name: 'Anna Berger', shortName: 'Anna', role: null },
      { name: 'Ben Krämer', shortName: null, role: null },
      { name: 'Lea Schmidt', shortName: 'Lea', role: 'lead' },
    ]);
    expect(parsed.invalid).toEqual([]);
  });

  test('accepts tabs and commas, flags bad lines and skips duplicates', () => {
    const parsed = parseWaiterList('Anna\tAn\nanna\nBen,Benny,service\nToo;Long-short-name\nX;Y;Chef');
    expect(parsed.items.map((i) => i.name)).toEqual(['Anna', 'Ben']);
    expect(parsed.duplicates).toEqual(['anna']);
    expect(parsed.invalid).toEqual([4, 5]);
  });
});

test.describe('Bedienungen: Tische und Darstellung', () => {
  test('"Mine" shows my tables, unassigned ones and my local carts', () => {
    expect(isMyTable({ waiterIds: ['w1'] }, 'w1')).toBe(true);
    expect(isMyTable({ waiterIds: [] }, 'w1')).toBe(true);
    expect(isMyTable({ waiterIds: ['w2'] }, 'w1')).toBe(false);
    expect(isMyTable({ waiterIds: ['w2'], localItems: 2 }, 'w1')).toBe(true);
    expect(isMyTable({ waiterIds: ['w2'] }, null)).toBe(true);
  });

  test('names the owner of a foreign table only', () => {
    expect(foreignOwner({ waiterId: 'w2' }, 'w1')).toBe('w2');
    expect(foreignOwner({ waiterId: 'w1' }, 'w1')).toBeNull();
    expect(foreignOwner({ waiterId: null }, 'w1')).toBeNull();
    expect(foreignOwner(undefined, 'w1')).toBeNull();
  });

  test('labels, initials and readable text colour', () => {
    expect(waiterLabel({ name: 'Anna Berger', shortName: null })).toBe('Anna');
    expect(waiterLabel({ name: 'Anna Berger', shortName: 'Anni' })).toBe('Anni');
    expect(waiterInitials('Anna Maria Berger')).toBe('AB');
    expect(waiterInitials('anna')).toBe('A');
    expect(textOn('#2563eb')).toBe('#fff');
    expect(textOn('#fde047')).toBe('#000');
    expect(textOn(null)).toBe('#fff');
  });

  test('puts ten PIN cards on an A4 page', () => {
    const cards = Array.from({ length: 23 }, (_, i) => i);
    expect(pinSheetPages(cards).map((p) => p.length)).toEqual([10, 10, 3]);
  });
});

test.describe('Kellnerabrechnung', () => {
  test('open tables block settling unless forced with a note', () => {
    expect(settlementBlocked(0, false, '')).toBe(false);
    expect(settlementBlocked(2, false, 'Notiz')).toBe(true);
    expect(settlementBlocked(2, true, '   ')).toBe(true);
    expect(settlementBlocked(2, true, 'Tisch 7 zahlt später')).toBe(false);
  });

  test('shift leads and admin members settle others', () => {
    expect(isLeadWaiter({ role: 'lead' })).toBe(true);
    expect(isLeadWaiter({ role: 'admin' })).toBe(true);
    expect(isLeadWaiter({ role: 'service' })).toBe(false);
    expect(isLeadWaiter({ role: 'member' })).toBe(false);
    expect(isLeadWaiter(null)).toBe(false);
  });

  test('handover targets leave out the current owner', () => {
    const tiles = [
      { id: 'a', shortName: 'Anna', color: '#2563eb' },
      { id: 'b', shortName: 'Ben', color: null },
    ];
    expect(handoverTargets(tiles, 'a').map((t) => t.id)).toEqual(['b']);
    expect(handoverTargets(tiles, null)).toHaveLength(2);
  });

  test('every settlement text exists in German and English', () => {
    const keys = (o: unknown, prefix = ''): string[] =>
      o && typeof o === 'object'
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
        : [prefix];
    expect(keys(en.waiterSettlement).sort()).toEqual(keys(de.waiterSettlement).sort());
    expect(keys(en.reports.waiters).sort()).toEqual(keys(de.reports.waiters).sort());
    for (const reason of [
      'WAITER_OPEN_TABLES',
      'WAITER_SETTLEMENT_EMPTY',
      'WAITER_SETTLEMENT_NOTE_REQUIRED',
      'WAITER_SETTLEMENT_NOT_FOUND',
      'WAITER_SETTLEMENT_COUNTED_INVALID',
      'WAITER_TRANSFER_INVALID',
    ]) {
      expect((de.apiErrors as Record<string, string>)[reason], reason).toBeTruthy();
      expect((en.apiErrors as Record<string, string>)[reason], reason).toBeTruthy();
    }
    expect(de.pos.orderHistory.timeline.transferred).toContain('{from}');
    expect(en.orders.history.timelineEvents.transferred).toContain('{to}');
  });
});

test.describe('Bedienungen: Arbeitnehmer (Lohnkonto)', () => {
  test('sends isEmployee only when it changes', () => {
    // Neu: nur, wenn angehakt.
    expect(employeeFlagPatch(undefined, false)).toEqual({});
    expect(employeeFlagPatch(undefined, true)).toEqual({ isEmployee: true });
    // Bearbeiten: nur die Änderung.
    expect(employeeFlagPatch(false, false)).toEqual({});
    expect(employeeFlagPatch(true, true)).toEqual({});
    expect(employeeFlagPatch(true, false)).toEqual({ isEmployee: false });
    expect(employeeFlagPatch(false, true)).toEqual({ isEmployee: true });
  });

  test('labels exist in both languages', () => {
    expect(de.waiters.form.isEmployee).toBe('Arbeitnehmer (Lohnkonto)');
    expect(de.waiters.form.isEmployeeHint).toContain('TrinkgeldAN');
    expect(en.waiters.form.isEmployee).toBeTruthy();
    expect(en.waiters.employeeBadge).toBeTruthy();
  });
});

test.describe('Kellnerabrechnung: TSE, Live-Kassensturz, Kartentrinkgeld', () => {
  const tse = { status: 'signed', failed: false, bonNumber: 1201, transactionNumber: 4711, signatureCounter: 9001, finishTime: null };

  test('settlement TSE state', () => {
    expect(settlementTseState(undefined)).toBeNull();
    expect(settlementTseState(null)).toBeNull();
    expect(settlementTseState(tse)).toEqual({ kind: 'signed', transactionNumber: 4711, bonNumber: 1201 });
    expect(settlementTseState({ ...tse, failed: true })).toEqual({ kind: 'failed' });
    expect(settlementTseState({ ...tse, status: 'pending' })).toEqual({ kind: 'failed' });
  });

  test('card tips are only offered to employees with something open', () => {
    expect(canPayOutCardTips(null)).toBe(false);
    expect(canPayOutCardTips(undefined)).toBe(false);
    expect(canPayOutCardTips(0)).toBe(false);
    expect(canPayOutCardTips(0.004)).toBe(false);
    expect(canPayOutCardTips(0.01)).toBe(true);
    expect(canPayOutCardTips(5.2)).toBe(true);
  });

  const row = (extra: Partial<LiveCashAuditRow> = {}): LiveCashAuditRow => ({
    subject: { kind: 'waiter', id: 'w1', waiterId: 'w1', userId: null, name: 'Anna', shortName: 'A', color: null, anonymized: false },
    periodFrom: null,
    cashExpected: 112.5,
    cashByDevice: [
      { deviceId: 'd1', deviceName: 'Theke', amount: 12.5 },
      { deviceId: null, deviceName: null, amount: 100 },
      { deviceId: 'd2', deviceName: 'Zelt', amount: 0 },
    ],
    payments: {
      cash: { count: 3, amount: 112.5 },
      card: { count: 2, amount: 40.2 },
      other: { count: 0, amount: 0 },
      total: { count: 5, amount: 152.7 },
    },
    tips: 6.4,
    openTables: 1,
    openCardTips: 5.2,
    lastSettlement: { id: 's1', number: 7, createdAt: '2026-11-10T18:00:00Z' },
    ...extra,
  });

  test('drawers: without empty ones, largest first', () => {
    expect(liveAuditDrawers(row()).map((d) => d.amount)).toEqual([100, 12.5]);
    expect(liveAuditDrawers(row({ cashByDevice: undefined }))).toEqual([]);
  });

  test('CSV rows', () => {
    expect(liveAuditCsvRows({ rows: [row(), row({ openCardTips: null, lastSettlement: null, payments: undefined, tips: null })] }, { noDevice: 'ohne Gerät' })).toEqual([
      ['Anna', 112.5, 'ohne Gerät: 100.00; Theke: 12.50', 40.2, 6.4, 1, 5.2, 7],
      ['Anna', 112.5, 'ohne Gerät: 100.00; Theke: 12.50', '', '', 1, '', ''],
    ]);
  });

  test('texts exist in both languages', () => {
    expect(de.waiterSettlement.list.electronicOnly).toBe('Kellnerabrechnungen werden ausschließlich elektronisch erzeugt und aufbewahrt.');
    expect(de.waiterSettlement.live.hint).toBe('Für eine Kassen-Nachschau: das Soll jeder Bedienung seit ihrer letzten Abrechnung.');
    expect(de.waiterSettlement.detail.copy).toBe('Kopie drucken');
    for (const messages of [de, en]) {
      expect(messages.apiErrors.TIP_PAYOUT_NOT_EMPLOYEE).toBeTruthy();
      expect(messages.apiErrors.TIP_PAYOUT_AMOUNT_INVALID).toBeTruthy();
      expect(messages.cashbook.summary.tipPayouts).toBeTruthy();
      expect(messages.waiterSettlement.tipPayout.checkbox).toContain('{amount}');
    }
  });
});
