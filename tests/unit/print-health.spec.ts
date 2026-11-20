import { expect, test } from '@playwright/test';

import { joinPrinterNames, posPrintWarning, printHealthNotice } from '@/lib/print-health';
import type { PrintHealth, PrintHealthPrinter } from '@/types/print-health';

function printer(name: string, overrides: Partial<PrintHealthPrinter> = {}): PrintHealthPrinter {
  return {
    printerId: `p-${name}`,
    name,
    agentDeviceId: 'agent-1',
    agentName: 'Pi Küche',
    agentOnline: true,
    printerOnline: true,
    waitingJobs: 0,
    oldestWaitingAt: null,
    failedJobs: 0,
    issues: [],
    ...overrides,
  };
}

function health(printers: PrintHealthPrinter[], overrides: Partial<PrintHealth> = {}): PrintHealth {
  const waitingJobs = printers.reduce((sum, p) => sum + p.waitingJobs, 0);
  const failedJobs = printers.reduce((sum, p) => sum + p.failedJobs, 0);
  return {
    status: waitingJobs || failedJobs ? 'error' : printers.length ? 'warning' : 'ok',
    checkedAt: '2026-11-20T12:00:00Z',
    waitingJobs,
    failedJobs,
    oldestWaitingAt: null,
    offlineAgents: [],
    printers,
    thresholds: { waitingSeconds: 30, failedWindowMinutes: 15 },
    ...overrides,
  };
}

const offlineKitchen = printer('Küchendrucker', {
  agentOnline: false,
  printerOnline: false,
  waitingJobs: 3,
  issues: ['agent_offline', 'jobs_waiting'],
});

test.describe('printHealthNotice (admin banner)', () => {
  test('nothing while everything prints', () => {
    expect(printHealthNotice(undefined)).toBeNull();
    expect(printHealthNotice(health([]))).toBeNull();
  });

  test('offline printer with waiting tickets comes first', () => {
    const notice = printHealthNotice(
      health(
        [
          offlineKitchen,
          printer('Bar', { failedJobs: 1, issues: ['jobs_failed'] }),
        ],
        { offlineAgents: [{ deviceId: 'agent-1', name: 'Pi Küche', printerIds: ['p-Küchendrucker'] }] },
      ),
    );
    expect(notice).toMatchObject({
      kind: 'offlineWaiting',
      tone: 'danger',
      printers: ['Küchendrucker'],
      agents: ['Pi Küche'],
      waitingJobs: 3,
      failedJobs: 1,
    });
  });

  test('waiting while connected, then failures, then offline-only warnings', () => {
    const waiting = printer('Grill', { waitingJobs: 2, issues: ['jobs_waiting'] });
    expect(printHealthNotice(health([waiting]))).toMatchObject({ kind: 'waiting', printers: ['Grill'] });

    const failed = printer('Bar', { failedJobs: 2, issues: ['jobs_failed'] });
    expect(printHealthNotice(health([failed]))).toMatchObject({
      kind: 'failed',
      tone: 'danger',
      failedJobs: 2,
    });

    const agentOff = printer('Küche', { agentOnline: false, issues: ['agent_offline'] });
    const paperOut = printer('Theke', { printerOnline: false, issues: ['printer_offline'] });
    expect(printHealthNotice(health([paperOut, agentOff]))).toMatchObject({
      kind: 'agentOffline',
      tone: 'warn',
      printers: ['Küche'],
    });
    expect(printHealthNotice(health([paperOut]))).toMatchObject({
      kind: 'printerOffline',
      tone: 'warn',
      printers: ['Theke'],
    });
  });
});

test.describe('printHealthNotice between events', () => {
  test('offline alone is no notice when no event runs, waiting tickets still are', () => {
    const agentOff = printer('Küche', { agentOnline: false, issues: ['agent_offline'] });
    expect(printHealthNotice(health([agentOff], { status: 'warning', eventRunning: false }))).toBeNull();
    expect(printHealthNotice(health([agentOff], { eventRunning: true }))).toMatchObject({ kind: 'agentOffline' });
    expect(printHealthNotice(health([offlineKitchen], { eventRunning: false }))).toMatchObject({
      kind: 'offlineWaiting',
    });
  });
});

test.describe('posPrintWarning (POS header)', () => {
  test('only for waiting or failed tickets, never for a printer that is merely offline', () => {
    expect(posPrintWarning(null)).toBeNull();
    expect(
      posPrintWarning(health([printer('Küche', { agentOnline: false, issues: ['agent_offline'] })])),
    ).toBeNull();
  });

  test('waiting tickets on an offline printer', () => {
    expect(posPrintWarning(health([offlineKitchen]))).toEqual({
      kind: 'waiting',
      count: 3,
      printers: ['Küchendrucker'],
      offline: true,
    });
  });

  test('failed tickets on a connected printer', () => {
    expect(
      posPrintWarning(health([printer('Bar', { failedJobs: 1, issues: ['jobs_failed'] })])),
    ).toEqual({ kind: 'failed', count: 1, printers: ['Bar'], offline: false });
  });
});

test.describe('joinPrinterNames', () => {
  test('lists names in the locale, shortens long lists', () => {
    expect(joinPrinterNames(['Küche'], 'de')).toBe('Küche');
    expect(joinPrinterNames(['Küche', 'Bar'], 'de')).toBe('Küche und Bar');
    expect(joinPrinterNames(['Kitchen', 'Bar'], 'en')).toBe('Kitchen and Bar');
    expect(joinPrinterNames(['A', 'B', 'C', 'D', 'E'], 'de')).toBe('A, B, C +2');
    expect(joinPrinterNames(['Küche', 'Küche', ''], 'de')).toBe('Küche');
  });
});
