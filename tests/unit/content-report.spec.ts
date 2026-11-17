import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { reportHref } from '@/lib/content-reports-api';
import { CONTENT_REPORT_ACTIONS, CONTENT_REPORT_REASONS, CONTENT_REPORT_STATUSES } from '@/types/content-report';

/*
 * „Inhalt melden“ (Art. 16 DSA): Link mit vorbelegter Fundstelle, und
 * jede Auswahl hat in beiden Sprachen einen Text.
 */

type Messages = Record<string, Record<string, unknown>>;
const messages = (lang: 'de' | 'en') =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'src', 'messages', `${lang}.json`), 'utf8')) as Messages;

test.describe('content reports', () => {
  test('report link carries the page as location', () => {
    expect(reportHref('https://app.openeos.de/s/sommerfest?x=1')).toBe(
      '/report?url=https%3A%2F%2Fapp.openeos.de%2Fs%2Fsommerfest%3Fx%3D1',
    );
    expect(reportHref(null)).toBe('/report');
  });

  for (const lang of ['de', 'en'] as const) {
    test(`all reasons, statuses and actions are translated (${lang})`, () => {
      const m = messages(lang);
      const reasons = (m.contentReport.reasons ?? {}) as Record<string, string>;
      const admin = (m.admin.reports ?? {}) as Record<string, Record<string, string>>;
      for (const reason of CONTENT_REPORT_REASONS) expect(reasons[reason]).toBeTruthy();
      for (const status of CONTENT_REPORT_STATUSES) expect(admin.status[status]).toBeTruthy();
      for (const action of CONTENT_REPORT_ACTIONS) expect(admin.actions[action]).toBeTruthy();
      expect((m.publicLegal as Record<string, string>).reportContent).toBeTruthy();
    });
  }
});
