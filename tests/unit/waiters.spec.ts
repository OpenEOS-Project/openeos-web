import { expect, test } from '@playwright/test';

import {
  ROLE_PERMISSIONS,
  autoLockSecondsOf,
  effectivePermissions,
  foreignOwner,
  isMyTable,
  may,
  parseWaiterList,
  permissionOverrides,
  pinSheetPages,
  shouldAutoLock,
  textOn,
  waiterInitials,
  waiterLabel,
  waiterModeOf,
} from '@/lib/waiters';
import type { PosWaiter } from '@/types/waiter';

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
